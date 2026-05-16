/**
 * history.js — Session history module.
 *
 * Stores and retrieves past session data per user.
 * Every session record includes topic, date, duration, scores, and metadata.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Endpoint                          │ Auth │ Description                  │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │  GET  /api/history                 │  ✓   │ All past sessions (paginated)│
 * │  GET  /api/history/stats           │  ✓   │ Aggregate performance stats  │
 * │  GET  /api/history/search          │  ✓   │ Search sessions by topic     │
 * │  GET  /api/history/:id             │  ✓   │ Single session full detail   │
 * │  DELETE /api/history/:id           │  ✓   │ Remove from personal history │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Query params for GET /api/history:
 *   page      (default 1)
 *   limit     (default 20, max 50)
 *   sort      "newest" | "oldest" | "score_high" | "score_low" | "duration_long" | "duration_short"
 *   status    "ended" | "active" | "all"  (default "ended")
 *   type      "individual" | "group" | "all"
 *   from      ISO date string — filter sessions after this date
 *   to        ISO date string — filter sessions before this date
 */

import { Router } from "express";
import { query, param } from "express-validator";
import { Session } from "../models/Session.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { generateFeedback } from "../lib/scoreCalculator.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds = 0) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Shape a raw session document into a clean history entry.
 * Attaches the requesting user's own report and strips other participants' details.
 */
function shapeHistoryEntry(session, userId) {
  // Find the participant entry with the most report data (handles duplicates)
  const myParticipants = session.participants?.filter(
    (p) => p.userId?.toString() === userId
  ) ?? [];
  const myParticipant = myParticipants.reduce(
    (best, p) => ((p.report?.turns ?? 0) >= (best?.report?.turns ?? 0) ? p : best),
    myParticipants[0] ?? null
  );

  const myReport = myParticipant?.report ?? null;

  // Generate auto-feedback if report has data but no feedback stored
  let feedback = myReport?.feedback || "";
  if (!feedback && myReport?.turns > 0) {
    feedback = generateFeedback({ ...myReport });
  }

  return {
    sessionId:         session.sessionId,
    type:              session.type,
    topic:             session.topic,
    topicSource:       session.topicSource,
    status:            session.status,
    date:              session.startedAt,
    endedAt:           session.endedAt,
    duration:          session.duration ?? 0,
    durationFormatted: formatDuration(session.duration),
    participantCount:  session.participants?.length ?? 0,
    host: session.hostId
      ? { id: session.hostId._id ?? session.hostId, name: session.hostId.name, email: session.hostId.email }
      : null,
    myReport: myReport
      ? {
          fluency:       myReport.fluency      ?? 0,
          relevance:     myReport.relevance     ?? 0,
          confidence:    myReport.confidence    ?? 0,
          fillerWords:   myReport.fillerWords   ?? 0,
          turns:         myReport.turns         ?? 0,
          overallScore:  myReport.overallScore  ?? 0,
          feedback,
          aiFeedback:    myReport.aiFeedback    ?? "",
          // Peer rating aggregates — null until ratings are submitted
          peerScore:     myReport.peerScore     ?? null,
          peerFeedback:  myReport.peerFeedback  ?? "",
          combinedScore: myReport.combinedScore ?? null,
        }
      : null,
  };
}

// ── Sort map ──────────────────────────────────────────────────────────────────
const SORT_MAP = {
  newest:         { startedAt: -1 },
  oldest:         { startedAt:  1 },
  score_high:     { "participants.report.overallScore": -1, startedAt: -1 },
  score_low:      { "participants.report.overallScore":  1, startedAt: -1 },
  duration_long:  { duration: -1, startedAt: -1 },
  duration_short: { duration:  1, startedAt: -1 },
};

// ── GET /api/history/stats — must be before /:id ──────────────────────────────
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const sessions = await Session.find({
      status: "ended",
      $or: [{ hostId: userId }, { "participants.userId": userId }],
    })
      .select("sessionId type topic duration startedAt participants")
      .lean();

    if (!sessions.length) {
      return res.json({
        success: true,
        stats: {
          totalSessions:   0,
          totalDuration:   0,
          avgOverallScore: 0,
          avgFluency:      0,
          avgRelevance:    0,
          avgConfidence:   0,
          avgFillerWords:  0,
          totalTurns:      0,
          bestScore:       0,
          bestTopic:       null,
          streak:          0,
          sessionsByType:  { individual: 0, group: 0 },
          recentTrend:     [],
        },
      });
    }

    // Extract user's own reports
    const reports = sessions
      .map((s) => {
        const p = s.participants?.find((p) => p.userId?.toString() === userId);
        return p?.report ?? null;
      })
      .filter((r) => r && r.turns > 0);

    const avg = (key) =>
      reports.length
        ? parseFloat((reports.reduce((s, r) => s + (r[key] ?? 0), 0) / reports.length).toFixed(2))
        : 0;

    const totalDuration = sessions.reduce((s, sess) => s + (sess.duration ?? 0), 0);

    // Best session
    const best = reports.reduce(
      (b, r, i) => (r.overallScore > (b?.overallScore ?? 0) ? { ...r, idx: i } : b),
      null
    );
    const bestTopic = best ? sessions[best.idx]?.topic ?? null : null;

    // Practice streak — consecutive calendar days with at least one session,
    // counting backwards from the most recent session date.
    // A streak of 1 means the user had a session today or yesterday (grace period).
    const uniqueDates = sessions
      .map((s) => {
        const d = new Date(s.startedAt);
        // Normalise to midnight UTC so date arithmetic is consistent
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      })
      .filter((d, i, a) => a.findIndex((x) => x.getTime() === d.getTime()) === i)
      .sort((a, b) => b - a); // newest first

    let streak = 0;
    if (uniqueDates.length > 0) {
      const todayUTC = new Date();
      const todayMidnight = new Date(Date.UTC(
        todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate()
      ));
      const MS_PER_DAY = 86_400_000;

      // Allow the streak to start from today OR yesterday (so a session done
      // earlier today still counts even if the user checks the dashboard later)
      const mostRecent = uniqueDates[0];
      const daysSinceMostRecent = Math.round(
        (todayMidnight - mostRecent) / MS_PER_DAY
      );

      // If the most recent session was more than 1 day ago, streak is 0
      if (daysSinceMostRecent <= 1) {
        streak = 1;
        // Walk backwards through the sorted unique dates
        for (let i = 1; i < uniqueDates.length; i++) {
          const diff = Math.round((uniqueDates[i - 1] - uniqueDates[i]) / MS_PER_DAY);
          if (diff === 1) {
            streak++;
          } else {
            break; // gap found — streak ends
          }
        }
      }
    }

    // Recent trend: last 7 sessions' overall scores (oldest first)
    const recentTrend = sessions
      .slice(0, 7)
      .reverse()
      .map((s) => {
        const p = s.participants?.find((p) => p.userId?.toString() === userId);
        return {
          sessionId: s.sessionId,
          date:      s.startedAt,
          score:     p?.report?.overallScore ?? 0,
        };
      });

    // Sessions by type
    const sessionsByType = sessions.reduce(
      (acc, s) => { acc[s.type] = (acc[s.type] ?? 0) + 1; return acc; },
      { individual: 0, group: 0 }
    );

    res.json({
      success: true,
      stats: {
        totalSessions:   sessions.length,
        totalDuration,
        totalDurationFormatted: formatDuration(totalDuration),
        avgOverallScore: avg("overallScore"),
        avgFluency:      avg("fluency"),
        avgRelevance:    avg("relevance"),
        avgConfidence:   avg("confidence"),
        avgFillerWords:  avg("fillerWords"),
        totalTurns:      reports.reduce((s, r) => s + (r.turns ?? 0), 0),
        bestScore:       best?.overallScore ?? 0,
        bestTopic,
        streak,
        sessionsByType,
        recentTrend,
      },
    });
  } catch (err) {
    console.error("[history] stats error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch stats." });
  }
});

// ── GET /api/history/search — must be before /:id ─────────────────────────────
router.get(
  "/search",
  requireAuth,
  [query("q").trim().notEmpty().withMessage("Search query q is required")],
  validate,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const q      = req.query.q.trim();
      const limit  = Math.min(20, parseInt(req.query.limit ?? "10", 10));

      const sessions = await Session.find({
        $or: [{ hostId: userId }, { "participants.userId": userId }],
        topic: { $regex: q, $options: "i" },
      })
        .sort({ startedAt: -1 })
        .limit(limit)
        .select("sessionId type topic topicSource status duration startedAt endedAt participants hostId")
        .populate("hostId", "name email")
        .lean();

      const results = sessions.map((s) => shapeHistoryEntry(s, userId));

      res.json({
        success: true,
        query:   q,
        count:   results.length,
        results,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: "Search failed." });
    }
  }
);

// ── GET /api/history — All past sessions ─────────────────────────────────────
router.get(
  "/",
  requireAuth,
  [
    query("page").optional().isInt({ min: 1 }).withMessage("page must be >= 1"),
    query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be 1–50"),
    query("sort").optional().isIn(Object.keys(SORT_MAP)).withMessage(`sort must be one of: ${Object.keys(SORT_MAP).join(", ")}`),
    query("status").optional().isIn(["ended", "active", "all"]),
    query("type").optional().isIn(["individual", "group", "all"]),
    query("from").optional().isISO8601().withMessage("from must be a valid ISO date"),
    query("to").optional().isISO8601().withMessage("to must be a valid ISO date"),
  ],
  validate,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const page   = Math.max(1, parseInt(req.query.page  ?? "1",  10));
      const limit  = Math.min(50, parseInt(req.query.limit ?? "20", 10));
      const skip   = (page - 1) * limit;
      const sort   = SORT_MAP[req.query.sort ?? "newest"];

      // ── Build filter ────────────────────────────────────────────────────────
      const filter = {
        $or: [{ hostId: userId }, { "participants.userId": userId }],
      };

      // Status filter
      const statusParam = req.query.status ?? "ended";
      if (statusParam !== "all") filter.status = statusParam;

      // Type filter
      if (req.query.type && req.query.type !== "all") {
        filter.type = req.query.type;
      }

      // Date range filter
      if (req.query.from || req.query.to) {
        filter.startedAt = {};
        if (req.query.from) filter.startedAt.$gte = new Date(req.query.from);
        if (req.query.to)   filter.startedAt.$lte = new Date(req.query.to);
      }

      // ── Query ───────────────────────────────────────────────────────────────
      const [sessions, total] = await Promise.all([
        Session.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .select("sessionId type topic topicSource status duration startedAt endedAt participants hostId")
          .populate("hostId", "name email")
          .lean(),
        Session.countDocuments(filter),
      ]);

      const entries = sessions.map((s) => shapeHistoryEntry(s, userId));

      res.json({
        success: true,
        sessions: entries,
        pagination: {
          page,
          limit,
          total,
          pages:    Math.ceil(total / limit),
          hasNext:  page * limit < total,
          hasPrev:  page > 1,
        },
        appliedFilters: {
          sort:   req.query.sort ?? "newest",
          status: statusParam,
          type:   req.query.type ?? "all",
          from:   req.query.from ?? null,
          to:     req.query.to   ?? null,
        },
      });
    } catch (err) {
      console.error("[history] list error:", err.message);
      res.status(500).json({ success: false, message: "Failed to fetch history." });
    }
  }
);

// ── GET /api/history/:id — Single session detail ──────────────────────────────
router.get(
  "/:id",
  requireAuth,
  [param("id").trim().notEmpty().withMessage("Session ID is required")],
  validate,
  async (req, res) => {
    try {
      const sessionId = req.params.id.toUpperCase();
      const userId    = req.user.id;

      const session = await Session.findOne({ sessionId })
        .populate("hostId", "name email avatar")
        .populate("participants.userId", "name email avatar")
        .lean();

      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found." });
      }

      // Verify user was part of this session
      const wasParticipant =
        session.hostId?._id?.toString() === userId ||
        session.participants.some((p) => p.userId?._id?.toString() === userId);

      if (!wasParticipant) {
        return res.status(403).json({
          success: false,
          message: "You were not a participant in this session.",
        });
      }

      // Deduplicate participants by userId — keep the entry with the most report data
      const participantMap = new Map();
      for (const p of session.participants) {
        const uid = p.userId?._id?.toString() ?? p.userId?.toString();
        if (!uid) continue;
        const existing = participantMap.get(uid);
        if (!existing || (p.report?.turns ?? 0) > (existing.report?.turns ?? 0)) {
          participantMap.set(uid, p);
        }
      }

      // Shape all participants with their reports
      const participants = [...participantMap.values()].map((p) => {
        const report = p.report ?? {};
        const isMe   = (p.userId?._id?.toString() ?? p.userId?.toString()) === userId;
        return {
          userId:   p.userId?._id ?? p.userId,
          name:     p.name,
          email:    isMe ? p.email : undefined,
          joinedAt: p.joinedAt,
          leftAt:   p.leftAt,
          isMe,
          report: {
            fluency:       report.fluency      ?? 0,
            relevance:     report.relevance     ?? 0,
            confidence:    report.confidence    ?? 0,
            fillerWords:   report.fillerWords   ?? 0,
            turns:         report.turns         ?? 0,
            overallScore:  report.overallScore  ?? 0,
            feedback:      report.feedback      || (report.turns > 0 ? generateFeedback({ ...report }) : ""),
            aiFeedback:    report.aiFeedback    ?? "",
            peerScore:     report.peerScore     ?? null,
            peerFeedback:  report.peerFeedback  ?? "",
            combinedScore: report.combinedScore ?? null,
          },
        };
      });

      // Sort participants by score descending for leaderboard view
      const ranked = [...participants]
        .filter((p) => p.report.turns > 0)
        .sort((a, b) => b.report.overallScore - a.report.overallScore)
        .map((p, i) => ({ ...p, rank: i + 1 }));

      res.json({
        success: true,
        session: {
          sessionId:         session.sessionId,
          type:              session.type,
          topic:             session.topic,
          topicSource:       session.topicSource,
          status:            session.status,
          host:              session.hostId,
          date:              session.startedAt,
          endedAt:           session.endedAt,
          duration:          session.duration ?? 0,
          durationFormatted: formatDuration(session.duration),
          participantCount:  participants.length,
          participants,
          leaderboard:       ranked,
          messages:          session.messages ?? [],
        },
      });
    } catch (err) {
      console.error("[history] detail error:", err.message);
      res.status(500).json({ success: false, message: "Failed to fetch session." });
    }
  }
);

// ── DELETE /api/history/:id — Remove from personal history ───────────────────
// Does NOT delete the session from DB — only removes the user from participants
// so it no longer appears in their history.
router.delete(
  "/:id",
  requireAuth,
  [param("id").trim().notEmpty()],
  validate,
  async (req, res) => {
    try {
      const sessionId = req.params.id.toUpperCase();
      const userId    = req.user.id;

      const session = await Session.findOne({ sessionId });
      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found." });
      }

      const idx = session.participants.findIndex(
        (p) => p.userId?.toString() === userId
      );

      if (idx === -1) {
        return res.status(400).json({
          success: false,
          message: "You are not a participant in this session.",
        });
      }

      // Mark participant as removed from history (soft delete)
      session.participants[idx].leftAt   = session.participants[idx].leftAt ?? new Date();
      session.participants[idx].isActive = false;

      // Remove from participants array entirely so it won't appear in history queries
      session.participants.splice(idx, 1);

      // If host removes themselves, reassign host to next participant
      if (session.hostId?.toString() === userId && session.participants.length > 0) {
        session.hostId = session.participants[0].userId;
      }

      await session.save();

      console.log(`[history] ${req.user.email} removed session ${sessionId} from history`);
      res.json({ success: true, message: "Session removed from your history." });
    } catch (err) {
      console.error("[history] delete error:", err.message);
      res.status(500).json({ success: false, message: "Failed to remove session." });
    }
  }
);

export default router;
