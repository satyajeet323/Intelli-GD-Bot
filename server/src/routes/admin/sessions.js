/**
 * admin/sessions.js — Session monitoring and management.
 */

import { Router } from "express";
import { Session } from "../../models/Session.js";
import { requirePermission, audit } from "../../middleware/adminAuth.js";
import { getAllSessions } from "../../sessionStore.js";

const router = Router();

// GET /api/admin/sessions — paginated session list
router.get("/", requirePermission("sessions.view"), async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  ?? "1"));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit ?? "20")));
    const search = req.query.search?.trim() ?? "";
    const status = req.query.status ?? "";
    const type   = req.query.type   ?? "";
    const from   = req.query.from   ?? "";
    const to     = req.query.to     ?? "";

    const filter = {};
    if (search) filter.topic = { $regex: search, $options: "i" };
    if (status) filter.status = status;
    if (type)   filter.type   = type;
    if (from || to) {
      filter.startedAt = {};
      if (from) filter.startedAt.$gte = new Date(from);
      if (to)   filter.startedAt.$lte = new Date(to);
    }

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("hostId", "name email")
        .lean(),
      Session.countDocuments(filter),
    ]);

    res.json({
      success: true,
      sessions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch sessions." });
  }
});

// GET /api/admin/sessions/live — in-memory active sessions
router.get("/live", requirePermission("sessions.view"), (req, res) => {
  try {
    const live = getAllSessions();
    res.json({ success: true, sessions: live, count: live.length });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch live sessions." });
  }
});

// GET /api/admin/sessions/stats
router.get("/stats", requirePermission("sessions.view"), async (req, res) => {
  try {
    const [total, active, ended, group, individual, today] = await Promise.all([
      Session.countDocuments(),
      Session.countDocuments({ status: "active" }),
      Session.countDocuments({ status: "ended" }),
      Session.countDocuments({ type: "group" }),
      Session.countDocuments({ type: "individual" }),
      Session.countDocuments({ startedAt: { $gte: new Date(Date.now() - 86400000) } }),
    ]);

    const avgDuration = await Session.aggregate([
      { $match: { status: "ended", duration: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: "$duration" } } },
    ]);

    const dailyActivity = await Session.aggregate([
      { $match: { startedAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      stats: {
        total, active, ended, group, individual, today,
        avgDurationSeconds: Math.round(avgDuration[0]?.avg ?? 0),
        dailyActivity,
        live: getAllSessions().length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch session stats." });
  }
});

// GET /api/admin/sessions/:id
router.get("/:id", requirePermission("sessions.view"), async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id })
      .populate("hostId", "name email")
      .lean();
    if (!session) return res.status(404).json({ success: false, message: "Session not found." });
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch session." });
  }
});

// DELETE /api/admin/sessions/:id
router.delete("/:id", requirePermission("sessions.delete"), async (req, res) => {
  try {
    const session = await Session.findOneAndDelete({ sessionId: req.params.id });
    if (!session) return res.status(404).json({ success: false, message: "Session not found." });

    await audit(req, `Deleted session: ${req.params.id}`, "sessions", {
      targetType: "Session", targetId: req.params.id, targetName: session.topic,
      severity: "warning",
    });

    res.json({ success: true, message: "Session deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete session." });
  }
});

export default router;
