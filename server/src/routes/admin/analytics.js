/**
 * admin/analytics.js — Platform analytics and system monitoring.
 */

import { Router } from "express";
import { User }    from "../../models/User.js";
import { Session } from "../../models/Session.js";
import { AuditLog } from "../../models/AuditLog.js";
import { requirePermission } from "../../middleware/adminAuth.js";
import { getAllSessions } from "../../sessionStore.js";

const router = Router();

// In-memory metrics store (resets on restart — use Redis in production)
const metrics = {
  apiCalls:       0,
  apiErrors:      0,
  apiLatencies:   [],   // last 1000 response times (ms)
  wsConnections:  0,
  failedLogins:   0,
  blockedIps:     new Set(),
  startTime:      Date.now(),
};

// Expose metrics object for middleware to update
export { metrics };

// GET /api/admin/analytics/overview
router.get("/overview", requirePermission("analytics.view"), async (req, res) => {
  try {
    const [totalUsers, totalSessions, activeSessions, newUsersToday] = await Promise.all([
      User.countDocuments(),
      Session.countDocuments(),
      Session.countDocuments({ status: "active" }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } }),
    ]);

    const liveCount = getAllSessions().length;
    const io = req.app.get("io");
    const wsCount = io?.engine?.clientsCount ?? 0;

    const avgLatency = metrics.apiLatencies.length
      ? Math.round(metrics.apiLatencies.reduce((a, b) => a + b, 0) / metrics.apiLatencies.length)
      : 0;

    const uptimeSeconds = Math.round((Date.now() - metrics.startTime) / 1000);

    res.json({
      success: true,
      overview: {
        totalUsers,
        totalSessions,
        activeSessions,
        newUsersToday,
        liveSessionsInMemory: liveCount,
        wsConnections: wsCount,
        apiCalls: metrics.apiCalls,
        apiErrors: metrics.apiErrors,
        avgLatencyMs: avgLatency,
        uptimeSeconds,
        failedLogins: metrics.failedLogins,
        blockedIps: metrics.blockedIps.size,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch overview." });
  }
});

// GET /api/admin/analytics/users
router.get("/users", requirePermission("analytics.view"), async (req, res) => {
  try {
    const days = parseInt(req.query.days ?? "30");
    const since = new Date(Date.now() - days * 86400000);

    const [growth, planDist, retentionRaw] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $group: { _id: "$plan", count: { $sum: 1 } } },
      ]),
      // Users with sessions in last 7 days (active users)
      Session.aggregate([
        { $match: { startedAt: { $gte: new Date(Date.now() - 7 * 86400000) } } },
        { $unwind: "$participants" },
        { $group: { _id: "$participants.userId" } },
        { $count: "activeUsers" },
      ]),
    ]);

    res.json({
      success: true,
      growth,
      planDistribution: planDist,
      activeUsersLast7Days: retentionRaw[0]?.activeUsers ?? 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch user analytics." });
  }
});

// GET /api/admin/analytics/sessions
router.get("/sessions", requirePermission("analytics.view"), async (req, res) => {
  try {
    const days = parseInt(req.query.days ?? "30");
    const since = new Date(Date.now() - days * 86400000);

    const [daily, typeBreakdown, avgScores, topTopics] = await Promise.all([
      Session.aggregate([
        { $match: { startedAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Session.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      Session.aggregate([
        { $match: { status: "ended" } },
        { $unwind: "$participants" },
        { $match: { "participants.report.overallScore": { $exists: true } } },
        {
          $group: {
            _id: null,
            avgScore:      { $avg: "$participants.report.overallScore" },
            avgFluency:    { $avg: "$participants.report.fluency" },
            avgRelevance:  { $avg: "$participants.report.relevance" },
            avgConfidence: { $avg: "$participants.report.confidence" },
          },
        },
      ]),
      Session.aggregate([
        { $group: { _id: "$topic", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    res.json({
      success: true,
      daily,
      typeBreakdown,
      avgScores: avgScores[0] ?? {},
      topTopics,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch session analytics." });
  }
});

// GET /api/admin/analytics/performance
router.get("/performance", requirePermission("analytics.view"), (req, res) => {
  const io = req.app.get("io");
  const wsCount = io?.engine?.clientsCount ?? 0;

  const latencies = metrics.apiLatencies.slice(-100);
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);

  res.json({
    success: true,
    performance: {
      uptime:        Math.round((Date.now() - metrics.startTime) / 1000),
      apiCalls:      metrics.apiCalls,
      apiErrors:     metrics.apiErrors,
      errorRate:     metrics.apiCalls > 0 ? ((metrics.apiErrors / metrics.apiCalls) * 100).toFixed(2) : "0",
      latency:       { p50, p95, p99, avg: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0 },
      wsConnections: wsCount,
      liveSessions:  getAllSessions().length,
      memoryMB:      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      memoryTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  });
});

// GET /api/admin/analytics/security
router.get("/security", requirePermission("analytics.view"), async (req, res) => {
  try {
    const recentAudit = await AuditLog.find({ severity: { $in: ["warning", "critical"] } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      security: {
        failedLogins:  metrics.failedLogins,
        blockedIps:    Array.from(metrics.blockedIps),
        recentAlerts:  recentAudit,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch security data." });
  }
});

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export default router;
