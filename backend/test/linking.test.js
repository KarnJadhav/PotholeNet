import request from "supertest";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import potholeRouter from "../src/routes/potholes.js";
import Pothole from "../src/models/Pothole.js";
import RoadSegment from "../src/models/RoadSegment.js";
import DetectionEvent from "../src/models/DetectionEvent.js";

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.set("io", io);
app.use("/api/potholes", potholeRouter);

describe("Pothole-RoadSegment Linking", () => {
  it("links pothole to road segment when map-matching succeeds", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          code: "Ok",
          waypoints: [{
            way_id: "123456",
            name: "Test Road",
            location: [73.8567, 18.5204],
            distance: 5
          }]
        })
      };
    };

    const response = await request(app)
      .post("/api/potholes")
      .send({
        latitude: 18.5204,
        longitude: 73.8567,
        confidence: 0.92,
        severity: "severe",
        source: "camera"
      });

    expect(response.status).toBe(201);

    const pothole = await Pothole.findById(response.body._id);
    expect(pothole).toBeTruthy();
    expect(pothole.confidence).toBe(0.92);
    expect(pothole.osmWayId).toBe("123456");
    expect(pothole.roadName).toBe("Test Road");

    const segment = await RoadSegment.findOne({ osmWayId: "123456" });
    expect(segment).toBeTruthy();
    expect(segment.roadName).toBe("Test Road");

    const events = await DetectionEvent.find({ potholeId: pothole._id });
    expect(events.length).toBe(1);

    global.fetch = originalFetch;
  });

  it("creates pothole without road segment when map-matching fails", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => { throw new Error("Network error"); };

    const response = await request(app)
      .post("/api/potholes")
      .send({
        latitude: 19.0760,
        longitude: 72.8777,
        confidence: 0.85,
        severity: "medium"
      });

    expect(response.status).toBe(201);

    const pothole = await Pothole.findById(response.body._id);
    expect(pothole).toBeTruthy();
    expect(pothole.roadSegmentId).toBeUndefined();

    global.fetch = originalFetch;
  });

  it("stores estimatedDepthCm when provided", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => { throw new Error("Network error"); };

    const response = await request(app)
      .post("/api/potholes")
      .send({
        latitude: 18.5204,
        longitude: 73.8567,
        confidence: 0.92,
        severity: "severe",
        estimatedDepthCm: 8.5
      });

    expect(response.status).toBe(201);

    const pothole = await Pothole.findById(response.body._id);
    expect(pothole.estimatedDepthCm).toBe(8.5);

    const event = await DetectionEvent.findOne({ potholeId: pothole._id });
    expect(event.estimatedDepthCm).toBe(8.5);

    global.fetch = originalFetch;
  });

  it("stores bbox array when provided", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => { throw new Error("Network error"); };

    const response = await request(app)
      .post("/api/potholes")
      .send({
        latitude: 18.5204,
        longitude: 73.8567,
        confidence: 0.92,
        severity: "medium",
        bbox: [0.32, 0.42, 0.61, 0.74]
      });

    expect(response.status).toBe(201);

    const event = await DetectionEvent.findOne({ potholeId: response.body._id });
    expect(event.bbox).toEqual([0.32, 0.42, 0.61, 0.74]);

    global.fetch = originalFetch;
  });

  it("aggregates detection history for a pothole", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => { throw new Error("Network error"); };

    const response = await request(app)
      .post("/api/potholes")
      .send({
        latitude: 18.5204,
        longitude: 73.8567,
        confidence: 0.90,
        severity: "minor"
      });

    const potholeId = response.body._id;

    await new Promise(resolve => setTimeout(resolve, 10));

    await request(app)
      .post("/api/potholes")
      .send({
        latitude: 18.520401,
        longitude: 73.856701,
        confidence: 0.85,
        severity: "medium"
      });

    const events = await DetectionEvent.find({ potholeId }).sort({ createdAt: 1 });
    expect(events.length).toBeGreaterThanOrEqual(1);

    global.fetch = originalFetch;
  });
});
