import request from "supertest";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import potholeRouter from "../src/routes/potholes.js";
import Pothole from "../src/models/Pothole.js";
import DetectionEvent from "../src/models/DetectionEvent.js";
import RoadSegment from "../src/models/RoadSegment.js";

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.set("io", io);
app.use("/api/potholes", potholeRouter);

describe("Detection Flow", () => {
  describe("POST /api/potholes", () => {
    it("creates a new pothole with valid data", async () => {
      const response = await request(app)
        .post("/api/potholes")
        .send({
          latitude: 18.5204,
          longitude: 73.8567,
          confidence: 0.92,
          severity: "medium",
          area: 0.085,
          source: "camera"
        });

      expect(response.status).toBe(201);
      expect(response.body.latitude).toBe(18.5204);
      expect(response.body.longitude).toBe(73.8567);
      expect(response.body.confidence).toBe(0.92);
      expect(response.body.severity).toBe("medium");
    });

    it("creates a DetectionEvent for each report", async () => {
      const response = await request(app)
        .post("/api/potholes")
        .send({
          latitude: 18.5204,
          longitude: 73.8567,
          confidence: 0.88,
          severity: "severe",
          source: "driving_mode"
        });

      expect(response.status).toBe(201);

      const events = await DetectionEvent.find({ potholeId: response.body._id });
      expect(events.length).toBe(1);
      expect(events[0].confidence).toBe(0.88);
      expect(events[0].severity).toBe("severe");
      expect(events[0].source).toBe("driving_mode");
    });

    it("clusters nearby potholes within 10 meters", async () => {
      await request(app)
        .post("/api/potholes")
        .send({
          latitude: 18.5204,
          longitude: 73.8567,
          confidence: 0.90,
          severity: "medium"
        });

      const response = await request(app)
        .post("/api/potholes")
        .send({
          latitude: 18.52041,
          longitude: 73.85671,
          confidence: 0.85,
          severity: "minor"
        });

      expect(response.status).toBe(200);

      const potholes = await Pothole.find({});
      expect(potholes.length).toBe(1);
      expect(potholes[0].reports.length).toBe(2);
    });

    it("creates separate potholes when far apart", async () => {
      await request(app)
        .post("/api/potholes")
        .send({
          latitude: 18.5204,
          longitude: 73.8567,
          confidence: 0.90,
          severity: "medium"
        });

      await request(app)
        .post("/api/potholes")
        .send({
          latitude: 18.5304,
          longitude: 73.8667,
          confidence: 0.85,
          severity: "minor"
        });

      const potholes = await Pothole.find({});
      expect(potholes.length).toBe(2);
    });

    it("rejects invalid coordinates", async () => {
      const response = await request(app)
        .post("/api/potholes")
        .send({
          latitude: 200,
          longitude: 73.8567,
          confidence: 0.90
        });

      expect(response.status).toBe(400);
    });
  });
});
