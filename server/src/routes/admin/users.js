/**
 * admin/users.js — User management routes.
 */

import { Router } from "express";
import { body, query } from "express-validator";
import bcrypt from "bcryptjs";
import { User }    from "../../models/User.js";
import { Session } from "../../models/Session.js";
import { requirePermission, audit } from "../../middleware/adminAuth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();

// GET /api/admin/users — list with search/filter/pagination
router.get(
  "/",
  requirePermission("users.view"),
  async (req, res) => {
    try {
      const page   = Math.max(1, parseInt(req.query.page  ?? "1"));
      const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit ?? "20")));
      const search = req.query.search?.trim() ?? "";
      const plan   = req.query.plan   ?? "";
      const status = req.query.status ?? ""; // "active" | "suspended"
      const sort   = req.query.sort   ?? "newest";
      const from   = req.query.from   ?? "";
      const to     = req.query.to     ?? "";

      const filter = {};
      if (search) {
        filter.$or = [
          { name:  { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }
      if (plan)   filter.plan = plan;
      if (status === "suspended") filter.isSuspended = true;
      if (status === "active")    filter.isSuspended = { $ne: true };
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to)   filter.createdAt.$lte = new Date(to);
      }

      const sortMap = {
        newest:    { createdAt: -1 },
        oldest:    { createdAt:  1 },
        name_asc:  { name:       1 },
        name_desc: { name:      -1 },
        plan:      { plan:       1 },
      };
      const sortObj = sortMap[sort] ?? { createdAt: -1 };

      const [users, total] = await Promise.all([
        User.find(filter).sort(sortObj).skip((page - 1) * limit).limit(limit).lean(),
        User.countDocuments(filter),
      ]);

      // Attach session counts
      const userIds = users.map((u) => u._id);
      const sessionCounts = await Session.aggregate([
        { $match: { "participants.userId": { $in: userIds } } },
        { $unwind: "$participants" },
        { $match: { "participants.userId": { $in: userIds } } },
        { $group: { _id: "$participants.userId", count: { $sum: 1 } } },
      ]);
      const countMap = Object.fromEntries(sessionCounts.map((s) => [s._id.toString(), s.count]));

      const enriched = users.map(({ password: _, ...u }) => ({
        ...u,
        sessionCount: countMap[u._id.toString()] ?? 0,
      }));

      res.json({
        success: true,
        users: enriched,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error("[admin/users] List error:", err.message);
      res.status(500).json({ success: false, message: "Failed to fetch users." });
    }
  }
);

// GET /api/admin/users/stats
router.get("/stats", requirePermission("users.view"), async (req, res) => {
  try {
    const [total, free, pro, suspended, newToday, newThisWeek] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ plan: "free" }),
      User.countDocuments({ plan: "pro" }),
      User.countDocuments({ isSuspended: true }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    ]);

    // Growth over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const growth = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, stats: { total, free, pro, suspended, newToday, newThisWeek, growth } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch stats." });
  }
});

// GET /api/admin/users/:id
router.get("/:id", requirePermission("users.view"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const sessions = await Session.find({
      "participants.userId": user._id,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("sessionId topic status startedAt endedAt duration participants")
      .lean();

    const { password: _, ...safe } = user;
    res.json({ success: true, user: safe, recentSessions: sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch user." });
  }
});

// PATCH /api/admin/users/:id — edit user
router.patch(
  "/:id",
  requirePermission("users.edit"),
  [
    body("name").optional().trim().notEmpty().isLength({ max: 100 }),
    body("plan").optional().isIn(["free", "pro", "enterprise"]),
    body("isSuspended").optional().isBoolean(),
    body("role").optional().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, plan, isSuspended, avatar } = req.body;
      const patch = {};
      if (name        !== undefined) patch.name        = name;
      if (plan        !== undefined) patch.plan        = plan;
      if (isSuspended !== undefined) patch.isSuspended = isSuspended;
      if (avatar      !== undefined) patch.avatar      = avatar;

      const user = await User.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true }).lean();
      if (!user) return res.status(404).json({ success: false, message: "User not found." });

      await audit(req, `Updated user: ${user.email}`, "users", {
        targetType: "User", targetId: user._id.toString(), targetName: user.email,
        details: patch,
      });

      const { password: _, ...safe } = user;
      res.json({ success: true, user: safe });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to update user." });
    }
  }
);

// POST /api/admin/users/:id/suspend
router.post("/:id/suspend", requirePermission("users.suspend"), async (req, res) => {
  try {
    const { reason = "" } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isSuspended: true, suspendedAt: new Date(), suspendReason: reason } },
      { new: true }
    ).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    await audit(req, `Suspended user: ${user.email}`, "users", {
      targetType: "User", targetId: user._id.toString(), targetName: user.email,
      details: { reason }, severity: "warning",
    });

    const { password: _, ...safe } = user;
    res.json({ success: true, user: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to suspend user." });
  }
});

// POST /api/admin/users/:id/activate
router.post("/:id/activate", requirePermission("users.suspend"), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isSuspended: false }, $unset: { suspendedAt: 1, suspendReason: 1 } },
      { new: true }
    ).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    await audit(req, `Activated user: ${user.email}`, "users", {
      targetType: "User", targetId: user._id.toString(), targetName: user.email,
    });

    const { password: _, ...safe } = user;
    res.json({ success: true, user: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to activate user." });
  }
});

// POST /api/admin/users/:id/reset-password
router.post(
  "/:id/reset-password",
  requirePermission("users.resetPassword"),
  [body("newPassword").isLength({ min: 8 }).withMessage("Min 8 characters")],
  validate,
  async (req, res) => {
    try {
      const { newPassword } = req.body;
      const hashed = await bcrypt.hash(newPassword, 12);
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { password: hashed } },
        { new: true }
      ).lean();
      if (!user) return res.status(404).json({ success: false, message: "User not found." });

      await audit(req, `Reset password for: ${user.email}`, "users", {
        targetType: "User", targetId: user._id.toString(), targetName: user.email,
        severity: "warning",
      });

      res.json({ success: true, message: "Password reset successfully." });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to reset password." });
    }
  }
);

// DELETE /api/admin/users/:id
router.delete("/:id", requirePermission("users.delete"), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    await audit(req, `Deleted user: ${user.email}`, "users", {
      targetType: "User", targetId: user._id.toString(), targetName: user.email,
      severity: "critical",
    });

    res.json({ success: true, message: "User deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete user." });
  }
});

export default router;
