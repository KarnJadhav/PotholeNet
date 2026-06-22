import jwt from "jsonwebtoken";

export const accessSecret = process.env.JWT_ACCESS_SECRET || "dev-access-secret";
export const refreshSecret = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id || user._id,
      email: user.email,
      role: user.role || "user"
    },
    accessSecret,
    { expiresIn: "15m" }
  );
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id || user._id }, refreshSecret, { expiresIn: "7d" });
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  try {
    req.user = jwt.verify(header.slice(7), accessSecret);
  } catch (_error) {
    req.user = null;
  }

  next();
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    next();
  });
}
