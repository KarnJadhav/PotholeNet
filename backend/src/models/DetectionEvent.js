import mongoose from "mongoose";

const detectionEventSchema = new mongoose.Schema(
  {
    potholeId: { type: mongoose.Schema.Types.ObjectId, ref: "Pothole" },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    severity: {
      type: String,
      enum: ["minor", "medium", "severe"],
      required: true
    },
    estimatedDepthCm: { type: Number, min: 0 },
    area: { type: Number, min: 0, default: 0 },
    bbox: [Number],
    source: {
      type: String,
      enum: ["camera", "driving_mode", "manual", "import"],
      default: "camera"
    },
    deviceId: String,
    imageHash: String,
    reportedBy: { type: String, default: "anonymous" }
  },
  { timestamps: true }
);

detectionEventSchema.index({ location: "2dsphere" });
detectionEventSchema.index({ potholeId: 1, createdAt: -1 });
detectionEventSchema.index({ createdAt: -1 });

detectionEventSchema.virtual("location").get(function location() {
  return { type: "Point", coordinates: [this.longitude, this.latitude] };
});

detectionEventSchema.set("toJSON", { virtuals: true });

export default mongoose.model("DetectionEvent", detectionEventSchema);
