import mongoose from "mongoose";
import RoadSegment from "../models/RoadSegment.js";

const severityWeight = { minor: 1, medium: 2, severe: 3 };

function calculateBounds(geometry) {
  if (!geometry?.coordinates?.length) return null;

  const coords = geometry.coordinates;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;

  for (const [lng, lat] of coords) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  return { minLat, maxLat, minLng, maxLng };
}

function calculateCenter(geometry) {
  if (!geometry?.coordinates?.length) {
    return { type: "Point", coordinates: [0, 0] };
  }

  const coords = geometry.coordinates;
  const sumLat = coords.reduce((sum, [, lat]) => sum + lat, 0);
  const sumLng = coords.reduce((sum, [lng]) => sum + lng, 0);

  return {
    type: "Point",
    coordinates: [sumLng / coords.length, sumLat / coords.length]
  };
}

export async function upsertRoadSegment(osmWayId, roadName, roadType, geometry) {
  if (!osmWayId || osmWayId === "unknown") {
    return null;
  }

  const center = calculateCenter(geometry);
  const bounds = calculateBounds(geometry);

  const segment = await RoadSegment.findOneAndUpdate(
    { osmWayId },
    {
      $set: {
        roadName,
        roadType,
        geometry,
        center,
        bounds
      },
      $setOnInsert: {
        potholeCount: 0,
        activePotholeCount: 0,
        severityScore: 0,
        healthScore: 100,
        risk: "Low"
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return segment;
}

export async function updateSegmentStats(segmentId) {
  if (!segmentId) return;

  const Pothole = mongoose.model("Pothole");

  const potholes = await Pothole.find({ roadSegmentId: segmentId, status: "active" });

  const potholeCount = potholes.length;
  const severityScore = potholes.reduce((sum, p) => sum + (severityWeight[p.severity] || 1), 0);
  const activePotholeCount = potholes.filter(p => p.status === "active").length;

  const healthScore = Math.max(0, Math.round(100 - severityScore * 8 - potholeCount * 4));
  const risk = healthScore < 45 ? "High" : healthScore < 75 ? "Moderate" : "Low";

  const lastIncident = potholes
    .map(p => p.updatedAt)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];

  await RoadSegment.findByIdAndUpdate(segmentId, {
    potholeCount,
    activePotholeCount,
    severityScore,
    healthScore,
    risk,
    lastIncidentAt: lastIncident || undefined
  });
}

export async function findNearbySegments(latitude, longitude, radiusMeters = 1000) {
  return RoadSegment.find({
    center: {
      $nearSphere: {
        $geometry: { type: "Point", coordinates: [longitude, latitude] },
        $maxDistance: radiusMeters
      }
    }
  }).limit(50);
}
