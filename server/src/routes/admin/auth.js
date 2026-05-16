/**
 * admin/auth.js — Admin authentication routes.
 * POST /api/admin/auth/login
 * GET  /api/admin/auth/me
 * POST /api/admin/auth/logout (audit only)
 */

import { Router } from "express";
import { body }   from "express-validator";
import { AdminUser } from "../../models/AdminUser.js";
import { AdminRole }  from "../../models/AdminRole.js";
import { signAdminToken, requireAdmin, audit } from "../../middleware/adminAuth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();

// POST /api/admin/auth/login
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const admin = await AdminUser.findOne({ email }).populate("role");
      if (!admin) {
        return res.status(401).json({ success: false, message: "Invalid credentials." });
      }
      if (!admin.isActive) {
        return res.status(403).json({ success: false, message: "Account suspended." });
      }
      const match = await admin.comparePassword(password);
      if (!match) {
        return res.status(401).json({ success: false, message: "Invalid credentials." });
      }

      // Update login metadata
      admin.lastLogin   = new Date();
      admin.lastLoginIp = req.ip ?? "";
      admin.loginCount  = (admin.loginCount ?? 0) + 1;
      await admin.save();

      const token = signAdminToken(admin);

      // Audit — attach admin to req temporarily so audit() can read it
      req.admin = admin.toObject ? admin.toObject() : admin;
      await audit(req, "Admin login", "auth", {
        severity: "info",
        details: { ip: req.ip },
      });

      res.json({ success: true, token, admin: admin.toJSON() });
    } catch (err) {
      console.error("[admin/auth] Login error:", err.message);
      res.status(500).json({ success: false, message: "Login failed." });
    }
  }
);

// GET /api/admin/auth/me
router.get("/me", requireAdmin, async (req, res) => {
  try {
    const admin = await AdminUser.findById(req.admin._id).populate("role").lean();
    if (!admin) return res.status(404).json({ success: false, message: "Not found." });
    const { password: _, ...safe } = admin;
    res.json({ success: true, admin: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch admin." });
  }
});

// POST /api/admin/auth/logout
router.post("/logout", requireAdmin, async (req, res) => {
  await audit(req, "Admin logout", "auth", { severity: "info" });
  res.json({ success: true, message: "Logged out." });
});

export default router;
