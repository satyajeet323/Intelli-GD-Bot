/**
 * adminAuth.js — Admin JWT authentication and permission middleware.
 *
 * Usage:
 *   requireAdmin                  — any authenticated admin
 *   requirePermission("users.edit") — admin with specific permission
 *   requireSuperAdmin             — super admin only
 */

import jwt from "jsonwebtoken";
import { AdminUser } from "../models/AdminUser.js";
import { AuditLog } from "../models/AuditLog.js";

const ADMIN_JWT_SECRET = () =>
  process.env.ADMIN_JWT_SECRET ?? process.env.JWT_SECRET ?? "admin_fallback_secret";

export function signAdminToken(admin) {
  return jwt.sign(
    { id: admin._id.toString(), name: admin.name, email: admin.email, isAdmin: true },
    ADMIN_JWT_SECRET(),
    { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN ?? "8h" }
  );
}

export async function requireAdmin(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Admin token required." });
  }

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET());
    if (!payload.isAdmin) {
      return res.status(403).json({ success: false, message: "Not an admin token." });
    }

    const admin = await AdminUser.findById(payload.id).populate("role").lean();
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: "Admin account not found or suspended." });
    }

    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired admin token." });
  }
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    // Re-use requireAdmin logic inline to avoid callback nesting issues
    const header = req.headers.authorization ?? "";
    const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: "Admin token required." });

    try {
      const payload = jwt.verify(token, ADMIN_JWT_SECRET());
      if (!payload.isAdmin) return res.status(403).json({ success: false, message: "Not an admin token." });

      const admin = await AdminUser.findById(payload.id).populate("role").lean();
      if (!admin || !admin.isActive) return res.status(401).json({ success: false, message: "Admin account not found or suspended." });

      req.admin = admin;

      if (admin.isSuperAdmin) return next();
      const perms = admin.role?.permissions ?? [];
      if (!perms.includes(permission)) {
        return res.status(403).json({ success: false, message: `Permission denied: ${permission}` });
      }
      next();
    } catch {
      return res.status(401).json({ success: false, message: "Invalid or expired admin token." });
    }
  };
}

export function requireSuperAdmin(req, res, next) {
  requireAdmin(req, res, () => {
    if (!req.admin.isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Super admin access required." });
    }
    next();
  });
}

/** Helper to write audit log entries from route handlers */
export async function audit(req, action, category, opts = {}) {
  try {
    await AuditLog.create({
      adminId:    req.admin._id,
      adminName:  req.admin.name,
      adminEmail: req.admin.email,
      action,
      category,
      targetType: opts.targetType ?? "",
      targetId:   opts.targetId   ?? "",
      targetName: opts.targetName ?? "",
      details:    opts.details    ?? {},
      ip:         req.ip ?? "",
      userAgent:  req.headers["user-agent"] ?? "",
      severity:   opts.severity   ?? "info",
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err.message);
  }
}
