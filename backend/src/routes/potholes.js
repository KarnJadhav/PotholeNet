import express from "express";
import mongoose from "mongoose";
import Pothole from "../models/Pothole.js";
import DetectionEvent from "../models/DetectionEvent.js";
import RoadSegment from "../models/RoadSegment.js";
import { createDetectionEvent } from "../services/detectionEvent.js";
import { matchToRoad, extractRoadType } from "../services/mapMatching.js";
import { upsertRoadSegment, updateSegmentStats } from "../services/roadSegment.js";

const router = express.Router();

const clusterRadiusMeters = Number(process.env.CLUSTER_RADIUS_METERS || 10);
const severityWeight = { minor: 1, medium: 2, severe: 3 };
const memoryPotholes = [];

function usingMemoryStore() {
  return mongoose.connection.readyState !== 1;
}

function distanceMeters(a, b) {
  const earthRadius = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function createMemoryPothole(report) {
  const now = new Date().toISOString();
  const reports = [{ ...report, createdAt: now, updatedAt: now }];
  return {
    id: crypto.randomUUID(),
    _id: crypto.randomUUID(),
    latitude: report.latitude,
    longitude: report.longitude,
    location: { type: "Point", coordinates: [report.longitude, report.latitude] },
    confidence: report.confidence,
    severity: report.severity,
    area: report.area,
    riskScore: calculateRiskScore(report.severity, reports),
    reports,
    votes: { stillExists: 0, fixed: 0, dangerous: 0 },
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

function normalizeReport(body) {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const confidence = Number(body.confidence ?? 0.8);
  const area = Number(body.area ?? 0);
  const estimatedDepthCm = body.estimatedDepthCm !== undefined ? Number(body.estimatedDepthCm) : undefined;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Valid latitude and longitude are required");
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Coordinates are outside valid GPS ranges");
  }

  return {
    latitude,
    longitude,
    confidence: Math.max(0, Math.min(1, confidence)),
    severity: ["minor", "medium", "severe"].includes(body.severity) ? body.severity : "medium",
    area: Number.isFinite(area) ? Math.max(0, area) : 0,
    estimatedDepthCm: Number.isFinite(estimatedDepthCm) ? Math.max(0, estimatedDepthCm) : undefined,
    bbox: Array.isArray(body.bbox) ? body.bbox : undefined,
    imageUrl: body.imageUrl,
    reportedBy: body.reportedBy || "anonymous",
    source: ["camera", "driving_mode", "manual", "import"].includes(body.source) ? body.source : "camera",
    deviceId: body.deviceId,
    imageHash: body.imageHash
  };
}

function aggregateSeverity(reports) {
  const average =
    reports.reduce((sum, report) => sum + severityWeight[report.severity], 0) / reports.length;

  if (average >= 2.5) return "severe";
  if (average >= 1.5) return "medium";
  return "minor";
}

function calculateRiskScore(severity, reports) {
  const severityComponent = (severityWeight[severity] / 3) * 50;
  const reportComponent = Math.min(reports.length, 10) / 10 * 30;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentReports = reports.filter((report) => {
    const createdAt = report.createdAt ? new Date(report.createdAt).getTime() : Date.now();
    return createdAt >= oneWeekAgo;
  }).length;
  const recentComponent = Math.min(recentReports, 5) / 5 * 20;

  return Math.round(severityComponent + reportComponent + recentComponent);
}

function enrichAnalytics(pothole) {
  const reportCount = pothole.reports?.length || 0;
  const latestReport = pothole.reports?.[reportCount - 1];
  const area =
    reportCount > 0
      ? pothole.reports.reduce((sum, report) => sum + Number(report.area || 0), 0) / reportCount
      : Number(pothole.area || 0);
  const riskScore = calculateRiskScore(pothole.severity, pothole.reports || []);

  pothole.area = area;
  pothole.riskScore = riskScore;
  pothole.lastReportedAt = latestReport?.createdAt || pothole.updatedAt;
  return pothole;
}

function summarizeDashboard(potholes) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const active = potholes.filter((pothole) => pothole.status !== "fixed");
  const newReportsToday = active.reduce(
    (sum, pothole) =>
      sum +
      (pothole.reports || []).filter((report) => new Date(report.createdAt || pothole.createdAt) >= today)
        .length,
    0
  );

  return {
    totals: {
      activeHazards: active.length,
      severeHazards: active.filter((pothole) => pothole.severity === "severe").length,
      newReportsToday,
      repairQueue: active.filter((pothole) => pothole.riskScore >= 50 || pothole.votes?.dangerous > 0).length
    },
    repairQueue: [...active]
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 20)
      .map((pothole) => ({
        id: pothole.id || pothole._id,
        roadName: "Unassigned road segment",
        latitude: pothole.latitude,
        longitude: pothole.longitude,
        potholes: pothole.reports?.length || 1,
        severity: pothole.severity,
        riskScore: pothole.riskScore,
        lastReportedAt: pothole.lastReportedAt || pothole.updatedAt
      })),
    trends: {
      severe: active.filter((pothole) => pothole.severity === "severe").length,
      medium: active.filter((pothole) => pothole.severity === "medium").length,
      minor: active.filter((pothole) => pothole.severity === "minor").length
    }
  };
}

router.get("/", async (req, res, next) => {
  try {
    if (usingMemoryStore()) {
      const { minLat, minLng, maxLat, maxLng } = req.query;
      const hasBounds = [minLat, minLng, maxLat, maxLng].every((value) => value !== undefined);
      const potholes = hasBounds
        ? memoryPotholes.filter(
            (pothole) =>
              pothole.latitude >= Number(minLat) &&
              pothole.latitude <= Number(maxLat) &&
              pothole.longitude >= Number(minLng) &&
              pothole.longitude <= Number(maxLng)
          )
        : memoryPotholes;

      return res.json(potholes.map(enrichAnalytics));
    }

    const { minLat, minLng, maxLat, maxLng } = req.query;
    const hasBounds = [minLat, minLng, maxLat, maxLng].every((value) => value !== undefined);

    const filter = hasBounds
      ? {
          location: {
            $geoWithin: {
              $box: [
                [Number(minLng), Number(minLat)],
                [Number(maxLng), Number(maxLat)]
              ]
            }
          }
        }
      : {};

    const potholes = await Pothole.find(filter).sort({ updatedAt: -1 }).limit(1000);
    res.json(potholes.map((pothole) => enrichAnalytics(pothole.toJSON())));
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", async (_req, res, next) => {
  try {
    if (usingMemoryStore()) {
      return res.json(summarizeDashboard(memoryPotholes.map(enrichAnalytics)));
    }

    const potholes = await Pothole.find({}).sort({ updatedAt: -1 }).limit(2000);
    res.json(summarizeDashboard(potholes.map((pothole) => enrichAnalytics(pothole.toJSON()))));
  } catch (error) {
    next(error);
  }
});

router.get("/nearby", async (req, res, next) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const radius = Number(req.query.radius || 100);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: "latitude and longitude are required" });
    }

    if (usingMemoryStore()) {
      const potholes = memoryPotholes
        .filter((pothole) => pothole.status === "active")
        .map((pothole) => ({
          pothole,
          distance: distanceMeters({ latitude, longitude }, pothole)
        }))
        .filter((item) => item.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 50)
        .map((item) => item.pothole);

      return res.json(potholes.map(enrichAnalytics));
    }

    const potholes = await Pothole.find({
      status: "active",
      location: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: radius
        }
      }
    }).limit(50);

    res.json(potholes.map((pothole) => enrichAnalytics(pothole.toJSON())));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const report = normalizeReport(req.body);

    if (usingMemoryStore()) {
      const existing = memoryPotholes.find(
        (pothole) => distanceMeters(report, pothole) <= clusterRadiusMeters
      );

      let pothole;

      if (existing) {
        existing.reports.push({ ...report, createdAt: new Date().toISOString() });
        existing.confidence =
          existing.reports.reduce((sum, item) => sum + item.confidence, 0) /
          existing.reports.length;
        existing.severity = aggregateSeverity(existing.reports);
        existing.area =
          existing.reports.reduce((sum, item) => sum + Number(item.area || 0), 0) /
          existing.reports.length;
        existing.riskScore = calculateRiskScore(existing.severity, existing.reports);
        existing.updatedAt = new Date().toISOString();
        pothole = enrichAnalytics(existing);
      } else {
        pothole = createMemoryPothole(report);
        memoryPotholes.unshift(pothole);
      }

      req.app.get("io").emit("pothole:upserted", pothole);
      return res.status(existing ? 200 : 201).json(pothole);
    }

    // Map-match to road
    const roadMatch = await matchToRoad(report.latitude, report.longitude);
    let roadSegment = null;

    if (roadMatch?.osmWayId && roadMatch.osmWayId !== "unknown") {
      roadSegment = await upsertRoadSegment(
        roadMatch.osmWayId,
        roadMatch.roadName,
        extractRoadType(roadMatch.roadName),
        {
          type: "LineString",
          coordinates: [
            [report.longitude, report.latitude],
            [roadMatch.matchedLocation.longitude, roadMatch.matchedLocation.latitude]
          ]
        }
      );
    }

    const existing = await Pothole.findOne({
      location: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [report.longitude, report.latitude] },
          $maxDistance: clusterRadiusMeters
        }
      }
    });

    let pothole;

    if (existing) {
      existing.reports.push(report);
      existing.confidence =
        existing.reports.reduce((sum, item) => sum + item.confidence, 0) / existing.reports.length;
      existing.severity = aggregateSeverity(existing.reports);
      existing.area =
        existing.reports.reduce((sum, item) => sum + Number(item.area || 0), 0) /
        existing.reports.length;
      existing.riskScore = calculateRiskScore(existing.severity, existing.reports);

      if (roadSegment) {
        existing.roadSegmentId = roadSegment._id;
        existing.osmWayId = roadSegment.osmWayId;
        existing.roadName = roadSegment.roadName;
        existing.roadType = roadSegment.roadType;
      }

      pothole = await existing.save();
    } else {
      pothole = await Pothole.create({
        location: { type: "Point", coordinates: [report.longitude, report.latitude] },
        confidence: report.confidence,
        severity: report.severity,
        area: report.area,
        estimatedDepthCm: report.estimatedDepthCm,
        riskScore: calculateRiskScore(report.severity, [report]),
        reports: [report],
        roadSegmentId: roadSegment?._id,
        osmWayId: roadMatch?.osmWayId,
        roadName: roadMatch?.roadName,
        roadType: roadMatch ? extractRoadType(roadMatch.roadName) : undefined
      });
    }

    // Create detection event
    await createDetectionEvent({
      potholeId: pothole._id,
      latitude: report.latitude,
      longitude: report.longitude,
      confidence: report.confidence,
      severity: report.severity,
      estimatedDepthCm: report.estimatedDepthCm,
      area: report.area,
      bbox: report.bbox,
      source: report.source,
      deviceId: report.deviceId,
      imageHash: report.imageHash,
      reportedBy: report.reportedBy
    });

    // Update segment stats
    if (roadSegment) {
      await updateSegmentStats(roadSegment._id);
    }

    const payload = enrichAnalytics(pothole.toJSON());
    req.app.get("io").emit("pothole:upserted", payload);
    res.status(existing ? 200 : 201).json(payload);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/vote", async (req, res, next) => {
  try {
    const vote = req.body.vote;

    if (!["stillExists", "fixed", "dangerous"].includes(vote)) {
      return res.status(400).json({ message: "vote must be stillExists, fixed, or dangerous" });
    }

    if (usingMemoryStore()) {
      const pothole = memoryPotholes.find(
        (item) => item.id === req.params.id || item._id === req.params.id
      );

      if (!pothole) return res.status(404).json({ message: "Pothole not found" });

      pothole.votes[vote] += 1;
      if (vote === "fixed" && pothole.votes.fixed >= pothole.votes.stillExists + 3) {
        pothole.status = "fixed";
      }
      pothole.updatedAt = new Date().toISOString();
      req.app.get("io").emit("pothole:upserted", pothole);
      return res.json(pothole);
    }

    const pothole = await Pothole.findById(req.params.id);
    if (!pothole) return res.status(404).json({ message: "Pothole not found" });

    pothole.votes[vote] += 1;
    if (vote === "fixed" && pothole.votes.fixed >= pothole.votes.stillExists + 3) {
      pothole.status = "fixed";
    }

    await pothole.save();
    req.app.get("io").emit("pothole:upserted", pothole);
    res.json(pothole);
  } catch (error) {
    next(error);
  }
});

router.use((error, _req, res, _next) => {
  res.status(400).json({ message: error.message || "Request failed" });
});

export default router;
