import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { refreshSecret, requireAuth, signAccessToken, signRefreshToken } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();
const memoryUsers = [];

function usingMemoryStore() {
  return mongoose.connection.readyState !== 1;
}

function publicUser(user) {
  const { passwordHash, refreshTokenHash, ...safeUser } = user;
  return safeUser;
}

async function tokenPayload(user) {
  const refreshToken = signRefreshToken(user);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  if (usingMemoryStore()) {
    user.refreshTokenHash = refreshTokenHash;
  } else {
    await User.findByIdAndUpdate(user.id || user._id, { refreshTokenHash });
  }

  return {
    user: publicUser(user.toJSON ? user.toJSON() : user),
    accessToken: signAccessToken(user),
    refreshToken
  };
}

router.post("/register", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 8) {
      return res.status(400).json({ message: "Name, email, and 8+ character password are required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (usingMemoryStore()) {
      if (memoryUsers.some((user) => user.email === email)) {
        return res.status(409).json({ message: "Email is already registered" });
      }

      const user = {
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash,
        role: memoryUsers.length === 0 ? "admin" : "user",
        reputation: 10,
        reportsSubmitted: 0,
        reportsVerified: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      memoryUsers.push(user);
      return res.status(201).json(await tokenPayload(user));
    }

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: (await User.countDocuments()) === 0 ? "admin" : "user"
    });

    res.status(201).json(await tokenPayload(user));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Email is already registered" });
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = usingMemoryStore()
      ? memoryUsers.find((item) => item.email === email)
      : await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json(await tokenPayload(user));
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken;
    const decoded = jwt.verify(refreshToken, refreshSecret);
    const user = usingMemoryStore()
      ? memoryUsers.find((item) => item.id === decoded.sub)
      : await User.findById(decoded.sub);

    if (!user || !user.refreshTokenHash || !(await bcrypt.compare(refreshToken, user.refreshTokenHash))) {
      return res.status(401).json({ message: "Refresh token is invalid" });
    }

    res.json(await tokenPayload(user));
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = usingMemoryStore()
      ? memoryUsers.find((item) => item.id === req.user.sub)
      : await User.findById(req.user.sub);

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(publicUser(user.toJSON ? user.toJSON() : user));
  } catch (error) {
    next(error);
  }
});

router.use((error, _req, res, _next) => {
  res.status(400).json({ message: error.message || "Authentication failed" });
});

export { memoryUsers };
export default router;
