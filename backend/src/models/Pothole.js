import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    confidence: { type: Number, min: 0, max: 1, required: true },
    severity: {
      type: String,
      enum: ["minor", "medium", "severe"],
      required: true
    },
    imageUrl: String,
    area: { type: Number, min: 0, default: 0 },
    reportedBy: { type: String, default: "anonymous" },
    source: { type: String, enum: ["camera", "driving_mode", "manual", "import"], default: "camera" }
  },
  { timestamps: true }
);

const potholeSchema = new mongoose.Schema(
  {
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value) => value.length === 2,
          message: "Coordinates must be [longitude, latitude]"
        }
      }
    },
    severity: {
      type: String,
      enum: ["minor", "medium", "severe"],
      required: true
    },
    confidence: { type: Number, min: 0, max: 1, required: true },
    area: { type: Number, min: 0, default: 0 },
    estimatedDepthCm: { type: Number, min: 0 },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    roadSegmentId: { type: mongoose.Schema.Types.ObjectId, ref: "RoadSegment" },
    osmWayId: String,
    roadName: String,
    roadType: String,
    reports: [reportSchema],
    votes: {
      stillExists: { type: Number, default: 0 },
      fixed: { type: Number, default: 0 },
      dangerous: { type: Number, default: 0 }
    },
    status: {
      type: String,
      enum: ["active", "fixed", "needs_review"],
      default: "active"
    }
  },
  { timestamps: true }
);

potholeSchema.index({ location: "2dsphere" });
potholeSchema.index({ roadSegmentId: 1 });
potholeSchema.index({ osmWayId: 1 });

potholeSchema.virtual("latitude").get(function latitude() {
  return this.location.coordinates[1];
});

potholeSchema.virtual("longitude").get(function longitude() {
  return this.location.coordinates[0];
});

potholeSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Pothole", potholeSchema);
