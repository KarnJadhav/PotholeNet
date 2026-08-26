import mongoose from "mongoose";

const roadSegmentSchema = new mongoose.Schema(
  {
    osmWayId: { type: String, required: true, index: true },
    roadName: { type: String, default: "Unknown road" },
    roadType: {
      type: String,
      enum: ["highway", "primary", "secondary", "tertiary", "residential", "service", "unclassified"],
      default: "unclassified"
    },
    geometry: {
      type: { type: String, enum: ["LineString"], default: "LineString" },
      coordinates: { type: [[Number]], required: true }
    },
    center: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }
    },
    bounds: {
      minLat: Number,
      maxLat: Number,
      minLng: Number,
      maxLng: Number
    },
    potholeCount: { type: Number, default: 0 },
    activePotholeCount: { type: Number, default: 0 },
    severityScore: { type: Number, default: 0 },
    healthScore: { type: Number, min: 0, max: 100, default: 100 },
    risk: { type: String, enum: ["Low", "Moderate", "High"], default: "Low" },
    lastIncidentAt: Date
  },
  { timestamps: true }
);

roadSegmentSchema.index({ geometry: "2dsphere" });
roadSegmentSchema.index({ center: "2dsphere" });
roadSegmentSchema.index({ healthScore: 1 });

roadSegmentSchema.virtual("latitude").get(function latitude() {
  return this.center.coordinates[1];
});

roadSegmentSchema.virtual("longitude").get(function longitude() {
  return this.center.coordinates[0];
});

roadSegmentSchema.set("toJSON", { virtuals: true });

export default mongoose.model("RoadSegment", roadSegmentSchema);
