import express from "express";
import mongoose from "mongoose";
import Pothole from "../models/Pothole.js";

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
  return {
    id: crypto.randomUUID(),
    _id: crypto.randomUUID(),
    latitude: report.latitude,
    longitude: report.longitude,
    location: { type: "Point", coordinates: [report.longitude, report.latitude] },
    confidence: report.confidence,
    severity: report.severity,
    reports: [{ ...report, createdAt: now, updatedAt: now }],
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
    imageUrl: body.imageUrl,
    reportedBy: body.reportedBy || "anonymous",
    source: body.source || "camera"
  };
}

function aggregateSeverity(reports) {
  const average =
    reports.reduce((sum, report) => sum + severityWeight[report.severity], 0) / reports.length;

  if (average >= 2.5) return "severe";
  if (average >= 1.5) return "medium";
  return "minor";
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

      return res.json(potholes);
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
    res.json(potholes);
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

      return res.json(potholes);
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

    res.json(potholes);
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
        existing.updatedAt = new Date().toISOString();
        pothole = existing;
      } else {
        pothole = createMemoryPothole(report);
        memoryPotholes.unshift(pothole);
      }

      req.app.get("io").emit("pothole:upserted", pothole);
      return res.status(existing ? 200 : 201).json(pothole);
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
      pothole = await existing.save();
    } else {
      pothole = await Pothole.create({
        location: { type: "Point", coordinates: [report.longitude, report.latitude] },
        confidence: report.confidence,
        severity: report.severity,
        reports: [report]
      });
    }

    req.app.get("io").emit("pothole:upserted", pothole);
    res.status(existing ? 200 : 201).json(pothole);
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
