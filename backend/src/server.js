import http from "node:http";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import { Server } from "socket.io";
import potholeRouter from "./routes/potholes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    methods: ["GET", "POST", "PATCH"]
  }
});

app.set("io", io);
app.use(helmet());
app.use(cors({ origin: clientOrigin }));
app.use(express.json({ limit: "6mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.use("/api/potholes", potholeRouter);

io.on("connection", (socket) => {
  socket.emit("connected", { message: "Realtime road hazard feed connected" });
});

mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/potholenet", {
    serverSelectionTimeoutMS: 3000
  })
  .then(() => {
    server.listen(port, () => {
      console.log(`PotholeNet API listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.warn("MongoDB connection failed:", error.message);
    console.warn("Starting with in-memory development storage. Reports reset when the server stops.");
    server.listen(port, () => {
      console.log(`PotholeNet API listening on http://localhost:${port}`);
    });
  });
