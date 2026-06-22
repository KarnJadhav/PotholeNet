import express from "express";
import mongoose from "mongoose";
import Pothole from "../models/Pothole.js";

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

router.get("/", async (req, res, next) => {
  try {
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

export default router;
