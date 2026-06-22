import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    reputation: { type: Number, default: 10 },
    reportsSubmitted: { type: Number, default: 0 },
    reportsVerified: { type: Number, default: 0 },
    refreshTokenHash: String
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    return ret;
  }
});

export default mongoose.model("User", userSchema);
