import mongoose from "mongoose";
import RoadSegment from "../src/models/RoadSegment.js";
import Pothole from "../src/models/Pothole.js";
import DetectionEvent from "../src/models/DetectionEvent.js";
import { upsertRoadSegment, updateSegmentStats } from "../src/services/roadSegment.js";
import { matchToRoad, extractRoadType } from "../src/services/mapMatching.js";

describe("RoadSegment Service", () => {
  describe("upsertRoadSegment", () => {
    it("creates a new road segment", async () => {
      const segment = await upsertRoadSegment(
        "12345",
        "Main Street",
        "primary",
        {
          type: "LineString",
          coordinates: [[73.8567, 18.5204], [73.8568, 18.5205]]
        }
      );

      expect(segment).toBeTruthy();
      expect(segment.osmWayId).toBe("12345");
      expect(segment.roadName).toBe("Main Street");
      expect(segment.roadType).toBe("primary");
      expect(segment.healthScore).toBe(100);
      expect(segment.risk).toBe("Low");
    });

    it("updates existing segment on upsert", async () => {
      await upsertRoadSegment(
        "12345",
        "Main Street",
        "primary",
        { type: "LineString", coordinates: [[73.8567, 18.5204], [73.8568, 18.5205]] }
      );

      const updated = await upsertRoadSegment(
        "12345",
        "Main Street Extended",
        "secondary",
        { type: "LineString", coordinates: [[73.8567, 18.5204], [73.8570, 18.5208]] }
      );

      expect(updated.roadName).toBe("Main Street Extended");
      expect(updated.roadType).toBe("secondary");

      const segments = await RoadSegment.find({ osmWayId: "12345" });
      expect(segments.length).toBe(1);
    });

    it("returns null for unknown way ID", async () => {
      const segment = await upsertRoadSegment(
        "unknown",
        "Unknown road",
        "unclassified",
        { type: "LineString", coordinates: [[73.8567, 18.5204]] }
      );

      expect(segment).toBeNull();
    });
  });

  describe("updateSegmentStats", () => {
    it("updates segment statistics from linked potholes", async () => {
      const segment = await upsertRoadSegment(
        "way123",
        "Test Road",
        "primary",
        { type: "LineString", coordinates: [[73.8567, 18.5204], [73.8568, 18.5205]] }
      );

      await Pothole.create({
        location: { type: "Point", coordinates: [73.8567, 18.5204] },
        confidence: 0.9,
        severity: "severe",
        roadSegmentId: segment._id,
        status: "active"
      });

      await Pothole.create({
        location: { type: "Point", coordinates: [73.8567, 18.5204] },
        confidence: 0.8,
        severity: "medium",
        roadSegmentId: segment._id,
        status: "active"
      });

      await updateSegmentStats(segment._id);

      const updated = await RoadSegment.findById(segment._id);
      expect(updated.potholeCount).toBe(2);
      expect(updated.activePotholeCount).toBe(2);
      expect(updated.severityScore).toBe(5);
      expect(updated.healthScore).toBeLessThan(100);
    });
  });
});

describe("Map Matching Service", () => {
  describe("extractRoadType", () => {
    it("identifies highway from road name", () => {
      expect(extractRoadType("NH 48 Highway")).toBe("highway");
      expect(extractRoadType("Mumbai Expressway")).toBe("highway");
    });

    it("identifies residential roads", () => {
      expect(extractRoadType("Shivaji Colony Road")).toBe("residential");
      expect(extractRoadType("Green Park Society")).toBe("residential");
    });

    it("returns unclassified for unknown patterns", () => {
      expect(extractRoadType("Some Random Road")).toBe("unclassified");
    });
  });

  describe("matchToRoad", () => {
    it("returns null when OSRM unavailable or invalid response", async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => { throw new Error("Network error"); };

      const result = await matchToRoad(18.5204, 73.8567);

      expect(result).toBeNull();

      global.fetch = originalFetch;
    });
  });
});
