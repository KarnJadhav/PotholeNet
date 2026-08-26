import mongoose from "mongoose";
import DetectionEvent from "../models/DetectionEvent.js";

export async function createDetectionEvent(data) {
  const event = await DetectionEvent.create({
    potholeId: data.potholeId,
    latitude: data.latitude,
    longitude: data.longitude,
    confidence: data.confidence,
    severity: data.severity,
    estimatedDepthCm: data.estimatedDepthCm,
    area: data.area,
    bbox: data.bbox,
    source: data.source,
    deviceId: data.deviceId,
    imageHash: data.imageHash,
    reportedBy: data.reportedBy
  });

  return event;
}

export async function getDetectionHistory(potholeId, options = {}) {
  const limit = options.limit || 100;

  return DetectionEvent.find({ potholeId })
    .sort({ createdAt: -1 })
    .limit(limit);
}

export async function analyzeTrend(potholeId) {
  const events = await DetectionEvent.find({ potholeId })
    .sort({ createdAt: 1 })
    .limit(50);

  if (events.length < 2) {
    return { trend: "insufficient_data", events: events.length };
  }

  const first = events[0];
  const last = events[events.length - 1];

  const depthChange = (last.estimatedDepthCm || 0) - (first.estimatedDepthCm || 0);
  const severityProgression = {
    minor: 1,
    medium: 2,
    severe: 3
  };

  const severityChange = (severityProgression[last.severity] || 1) - (severityProgression[first.severity] || 1);

  let trend = "stable";
  if (depthChange > 2 || severityChange > 0) {
    trend = "deteriorating";
  } else if (depthChange < -2 || severityChange < 0) {
    trend = "improving";
  }

  return {
    trend,
    events: events.length,
    depthChange: depthChange || 0,
    severityChange,
    firstDetected: first.createdAt,
    lastDetected: last.createdAt
  };
}
