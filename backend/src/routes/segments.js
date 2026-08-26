import express from "express";
import mongoose from "mongoose";
import Pothole from "../models/Pothole.js";
import RoadSegment from "../models/RoadSegment.js";

const router = express.Router();

function severityWeight(severity) {
  if (severity === "severe") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function segmentKey(latitude, longitude) {
  return `${Math.round(latitude * 1000)}:${Math.round(longitude * 1000)}`;
}

function buildSegment(potholes) {
  const reportCount = potholes.reduce((sum, pothole) => sum + (pothole.reports?.length || 1), 0);
  const severityScore = potholes.reduce(
    (sum, pothole) => sum + severityWeight(pothole.severity) * (pothole.reports?.length || 1),
    0
  );
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentIncidents = potholes.reduce(
    (sum, pothole) =>
      sum +
      (pothole.reports || []).filter((report) => new Date(report.createdAt || pothole.createdAt) >= recentCutoff)
        .length,
    0
  );
  const center = potholes.reduce(
    (point, pothole) => ({
      latitude: point.latitude + pothole.latitude / potholes.length,
      longitude: point.longitude + pothole.longitude / potholes.length
    }),
    { latitude: 0, longitude: 0 }
  );
  const healthScore = Math.max(0, Math.round(100 - severityScore * 8 - reportCount * 4 - recentIncidents * 3));
  const risk = healthScore < 45 ? "High" : healthScore < 75 ? "Moderate" : "Low";
  const span = 0.0012;

  return {
    id: segmentKey(center.latitude, center.longitude),
    roadName: "Crowdsourced road segment",
    center,
    path: [
      [center.latitude - span, center.longitude - span],
      [center.latitude + span, center.longitude + span]
    ],
    potholes: potholes.length,
    reportCount,
    recentIncidents,
    severityScore,
    healthScore,
    risk
  };
}

// GET /api/segments - Return segments from RoadSegment collection or fallback to computed
router.get("/", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const segments = await RoadSegment.find({})
        .sort({ healthScore: 1 })
        .limit(500);

      if (segments.length > 0) {
        return res.json(segments.map(segment => ({
          id: segment._id,
          osmWayId: segment.osmWayId,
          roadName: segment.roadName,
          roadType: segment.roadType,
          center: { latitude: segment.latitude, longitude: segment.longitude },
          path: segment.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [],
          potholes: segment.potholeCount,
          activePotholes: segment.activePotholeCount,
          severityScore: segment.severityScore,
          healthScore: segment.healthScore,
          risk: segment.risk,
          lastIncidentAt: segment.lastIncidentAt
        })));
      }
    }

    // Fallback: compute from potholes
    let source = req.app.locals.memoryPotholes || [];

    if (mongoose.connection.readyState === 1) {
      source = (await Pothole.find({ status: "active" }).limit(2000)).map((pothole) => pothole.toJSON());
    }

    const grouped = new Map();
    source.forEach((pothole) => {
      const key = segmentKey(pothole.latitude, pothole.longitude);
      grouped.set(key, [...(grouped.get(key) || []), pothole]);
    });

    res.json([...grouped.values()].map(buildSegment).sort((a, b) => a.healthScore - b.healthScore));
  } catch (error) {
    next(error);
  }
});

// GET /api/segments/:id - Get single segment with potholes
router.get("/:id", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database required for segment lookup" });
    }

    const segment = await RoadSegment.findById(req.params.id);

    if (!segment) {
      return res.status(404).json({ message: "Segment not found" });
    }

    const potholes = await Pothole.find({ roadSegmentId: segment._id, status: "active" });

    res.json({
      ...segment.toJSON(),
      potholeList: potholes.map(p => p.toJSON())
    });
  } catch (error) {
    next(error);
  }
});

export default router;
