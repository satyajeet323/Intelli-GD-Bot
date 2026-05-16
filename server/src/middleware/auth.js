/**
 * auth.js — JWT authentication middleware.
 * Attach to any route that requires a logged-in user.
 *
 * Usage:
 *   import { requireAuth } from "./middleware/auth.js";
 *   router.get("/protected", requireAuth, handler);
 *
 * The decoded payload is attached to req.user = { id, name, email }
 */

import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? "fallback_secret");
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

export function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), name: user.name, email: user.email },
    process.env.JWT_SECRET ?? "fallback_secret",
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
  );
}
