/**
 * auth.js — Authentication routes.
 *
 * POST /api/auth/register  — Create account
 * POST /api/auth/login     — Login, returns JWT
 * GET  /api/auth/me        — Get current user (requires token)
 */

import { Router } from "express";
import { body } from "express-validator";
import { User } from "../models/User.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 100 }),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ success: false, message: "Email already registered." });
      }

      const user = await User.create({ name, email, password });
      const token = signToken(user);

      console.log(`[auth] Registered: ${email}`);
      res.status(201).json({ success: true, token, user });
    } catch (err) {
      console.error("[auth] Register error:", err.message);
      res.status(500).json({ success: false, message: "Registration failed." });
    }
  }
);

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ success: false, message: "Invalid email or password." });
      }

      const match = await user.comparePassword(password);
      if (!match) {
        return res.status(401).json({ success: false, message: "Invalid email or password." });
      }

      const token = signToken(user);
      console.log(`[auth] Login: ${email}`);
      res.json({ success: true, token, user });
    } catch (err) {
      console.error("[auth] Login error:", err.message);
      res.status(500).json({ success: false, message: "Login failed." });
    }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const userObj = user.toObject();
    userObj.isAdmin = user.role === "admin";

    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch user." });
  }
});

// ── PATCH /api/auth/profile — Update name / password ─────────────────────────
router.patch(
  "/profile",
  requireAuth,
  [
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty")
      .isLength({ max: 100 }),
    body("currentPassword")
      .if(body("newPassword").exists())
      .notEmpty()
      .withMessage("Current password is required to set a new one"),
    body("newPassword")
      .optional()
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: "User not found." });

      if (name) user.name = name;

      if (newPassword) {
        const match = await user.comparePassword(currentPassword);
        if (!match) {
          return res.status(400).json({ success: false, message: "Current password is incorrect." });
        }
        user.password = newPassword; // pre-save hook will hash it
      }

      await user.save();
      console.log(`[auth] Profile updated: ${user.email}`);
      res.json({ success: true, user });
    } catch (err) {
      console.error("[auth] Profile update error:", err.message);
      res.status(500).json({ success: false, message: "Failed to update profile." });
    }
  }
);

// ── PATCH /api/auth/preferences — Update user preferences ────────────────────
router.patch(
  "/preferences",
  requireAuth,
  [
    body("micEnabled").optional().isBoolean(),
    body("noiseSuppression").optional().isBoolean(),
    body("echoCancellation").optional().isBoolean(),
    body("practiceReminders").optional().isBoolean(),
    body("sessionSummary").optional().isBoolean(),
    body("weeklyReport").optional().isBoolean(),
    body("aiPersona")
      .optional()
      .isIn(["friendly", "critical", "devils-advocate", "neutral"])
      .withMessage("aiPersona must be friendly, critical, devils-advocate, or neutral"),
  ],
  validate,
  async (req, res) => {
    try {
      const allowed = [
        "micEnabled", "noiseSuppression", "echoCancellation",
        "practiceReminders", "sessionSummary", "weeklyReport",
        "aiPersona",
      ];

      // Build a $set patch only for fields that were sent
      const patch = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          patch[`preferences.${key}`] = req.body[key];
        }
      }

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ success: false, message: "No valid preference fields provided." });
      }

      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: patch },
        { new: true, select: "-password" }
      );

      if (!user) return res.status(404).json({ success: false, message: "User not found." });

      console.log(`[auth] Preferences updated: ${user.email}`);
      res.json({ success: true, preferences: user.preferences });
    } catch (err) {
      console.error("[auth] Preferences update error:", err.message);
      res.status(500).json({ success: false, message: "Failed to update preferences." });
    }
  }
);

export default router;
