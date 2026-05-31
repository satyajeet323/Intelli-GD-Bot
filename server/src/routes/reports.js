/**
 * reports.js — Performance tracking and reporting API.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Endpoint                                  │ Auth │ Description          │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │  POST /api/reports/:sessionId              │  ✓   │ Submit final report  │
 * │  PATCH /api/reports/:sessionId/turn        │  ✓   │ Record a single turn │
 * │  GET  /api/reports/:sessionId              │  —   │ Full session report  │
 * │  GET  /api/reports/:sessionId/me           │  ✓   │ My report only       │
 * │  GET  /api/reports/:sessionId/summary      │  —   │ Aggregated stats     │
 * │  GET  /api/reports/:sessionId/leaderboard  │  —   │ Ranked participants  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { Router } from "express";
import { body, param } from "express-validator";
import { Session } from "../models/Session.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  calculateOverallScore,
  generateFeedback,
  aggregateReports,
  countFillerWords,
} from "../lib/scoreCalculator.js";

const router = Router();

// ── Shared validation chains ──────────────────────────────────────────────────
const scoreValidators = [
  body("fluency")
    .isFloat({ min: 0, max: 10 })
    .withMessage("fluency must be a number between 0 and 10"),
  body("relevance")
    .isFloat({ min: 0, max: 10 })
    .withMessage("relevance must be a number between 0 and 10"),
  body("confidence")
    .isFloat({ min: 0, max: 10 })
    .withMessage("confidence must be a number between 0 and 10"),
  body("fillerWords")
    .isInt({ min: 0 })
    .withMessage("fillerWords must be a non-negative integer"),
  body("turns")
    .isInt({ min: 0 })
    .withMessage("turns must be a non-negative integer"),
];

// ── POST /api/reports/:sessionId — Submit final report ────────────────────────
router.post(
  "/:sessionId",
  requireAuth,
  [
    param("sessionId").trim().notEmpty().withMessage("sessionId is required"),
    ...scoreValidators,
    body("feedback").optional().isString().isLength({ max: 2000 }),
    body("aiFeedback").optional().isString().isLength({ max: 2000 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { fluency, relevance, confidence, fillerWords, turns, feedback, aiFeedback } = req.body;
      const sessionId = req.params.sessionId.toUpperCase();

      const session = await Session.findOne({ sessionId });
      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found." });
      }

      // Calculate derived scores
      const overallScore = calculateOverallScore({ fluency, relevance, confidence, fillerWords });
      const autoFeedback = generateFeedback({ fluency, relevance, confidence, fillerWords, turns, overallScore });

      // Find or create participant entry
      const userId = req.user.id;
      let participantIdx = session.participants.findIndex(
        (p) => p.userId?.toString() === userId
      );

      if (participantIdx === -1) {
        session.participants.push({
          userId,
          name:     req.user.name,
          email:    req.user.email,
          joinedAt: new Date(),
          isActive: false,
          report:   {},
        });
        participantIdx = session.participants.length - 1;
      }

      // Save report
      session.participants[participantIdx].report = {
        fluency:      parseFloat(fluency),
        relevance:    parseFloat(relevance),
        confidence:   parseFloat(confidence),
        fillerWords:  parseInt(fillerWords, 10),
        turns:        parseInt(turns, 10),
        overallScore,
        feedback:     feedback   ?? autoFeedback,
        aiFeedback:   aiFeedback ?? "",
      };

      await session.save();

      // Auto-end individual sessions when a report is submitted — this ensures
      // they always appear in history (which filters by status: "ended").
      if (session.type === "individual" && session.status !== "ended") {
        session.status  = "ended";
        session.endedAt = new Date();
        session.duration = Math.round((session.endedAt - session.startedAt) / 1000);
        // Mark the participant as no longer active
        const p = session.participants[participantIdx];
        if (p && p.isActive) {
          p.isActive = false;
          p.leftAt   = session.endedAt;
        }
        await session.save();
        console.log(`[reports] Auto-ended individual session ${sessionId}`);
      }

      console.log(
        `[reports] Saved: ${req.user.email} | session: ${sessionId} | score: ${overallScore}`
      );

      res.json({
        success: true,
        report: {
          ...session.participants[participantIdx].report,
          autoFeedback,
        },
      });
    } catch (err) {
      console.error("[reports] POST error:", err.message);
      res.status(500).json({ success: false, message: "Failed to save report." });
    }
  }
);

// ── PATCH /api/reports/:sessionId/turn — Record a single speaking turn ────────
// Called after each user turn during a live session to accumulate metrics.
router.patch(
  "/:sessionId/turn",
  requireAuth,
  [
    param("sessionId").trim().notEmpty(),
    body("text")
      .optional()
      .isString()
      .isLength({ max: 5000 })
      .withMessage("text must be a string under 5000 chars"),
    body("fluency")
      .optional()
      .isFloat({ min: 0, max: 10 }),
    body("relevance")
      .optional()
      .isFloat({ min: 0, max: 10 }),
    body("confidence")
      .optional()
      .isFloat({ min: 0, max: 10 }),
  ],
  validate,
  async (req, res) => {
    try {
      const sessionId = req.params.sessionId.toUpperCase();
      const { text = "", fluency = 0, relevance = 0, confidence = 0 } = req.body;

      const session = await Session.findOne({ sessionId });
      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found." });
      }

      const userId = req.user.id;
      let participantIdx = session.participants.findIndex(
        (p) => p.userId?.toString() === userId
      );

      if (participantIdx === -1) {
        session.participants.push({
          userId,
          name:     req.user.name,
          email:    req.user.email,
          joinedAt: new Date(),
          isActive: true,
          report:   { fluency: 0, relevance: 0, confidence: 0, fillerWords: 0, turns: 0, overallScore: 0 },
        });
        participantIdx = session.participants.length - 1;
      }

      const report = session.participants[participantIdx].report;
      const prevTurns = report.turns ?? 0;

      // Detect filler words in this turn's text
      const turnFillers = countFillerWords(text);

      // Running average for scored metrics
      const newTurns = prevTurns + 1;
      const avg = (prev, curr) =>
        parseFloat(((prev * prevTurns + curr) / newTurns).toFixed(2));

      report.fluency     = avg(report.fluency     ?? 0, parseFloat(fluency));
      report.relevance   = avg(report.relevance   ?? 0, parseFloat(relevance));
      report.confidence  = avg(report.confidence  ?? 0, parseFloat(confidence));
      report.fillerWords = (report.fillerWords ?? 0) + turnFillers;
      report.turns       = newTurns;
      report.overallScore = calculateOverallScore({
        fluency:     report.fluency,
        relevance:   report.relevance,
        confidence:  report.confidence,
        fillerWords: report.fillerWords,
      });

      // Mark as modified so Mongoose saves the nested object
      session.markModified(`participants.${participantIdx}.report`);
      await session.save();

      res.json({
        success: true,
        turnNumber:   newTurns,
        turnFillers,
        runningReport: {
          fluency:      report.fluency,
          relevance:    report.relevance,
          confidence:   report.confidence,
          fillerWords:  report.fillerWords,
          turns:        report.turns,
          overallScore: report.overallScore,
        },
      });
    } catch (err) {
      console.error("[reports] PATCH /turn error:", err.message);
      res.status(500).json({ success: false, message: "Failed to record turn." });
    }
  }
);

// ── GET /api/reports/:sessionId/me — My report only ──────────────────────────
// Must be before /:sessionId to avoid route conflict
router.get("/:sessionId/me", requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.sessionId.toUpperCase();
    const session = await Session.findOne({ sessionId }).lean();

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    const participant = session.participants.find(
      (p) => p.userId?.toString() === req.user.id
    );

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "You have no report for this session.",
      });
    }

    const report = participant.report ?? {};
    const feedback = report.overallScore > 0
      ? generateFeedback({ ...report })
      : "No data yet — complete the session to see your feedback.";

    res.json({
      success: true,
      sessionId,
      topic:   session.topic,
      participant: {
        name:     participant.name,
        joinedAt: participant.joinedAt,
        leftAt:   participant.leftAt,
      },
      report: {
        ...report,
        autoFeedback:  feedback,
        // Peer rating aggregates
        peerScore:     report.peerScore     ?? null,
        peerFeedback:  report.peerFeedback  ?? "",
        combinedScore: report.combinedScore ?? null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch your report." });
  }
});

// ── GET /api/reports/:sessionId/summary — Aggregated session stats ────────────
router.get("/:sessionId/summary", async (req, res) => {
  try {
    const sessionId = req.params.sessionId.toUpperCase();
    const session = await Session.findOne({ sessionId }).lean();

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    const reports = session.participants
      .map((p) => p.report)
      .filter((r) => r && r.turns > 0);

    const stats = aggregateReports(reports);

    res.json({
      success: true,
      sessionId,
      topic:        session.topic,
      topicSource:  session.topicSource,
      status:       session.status,
      duration:     session.duration,
      durationFormatted: formatDuration(session.duration),
      startedAt:    session.startedAt,
      endedAt:      session.endedAt,
      summary:      stats,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch summary." });
  }
});

// ── GET /api/reports/:sessionId/leaderboard — Ranked participants ─────────────
router.get("/:sessionId/leaderboard", async (req, res) => {
  try {
    const sessionId = req.params.sessionId.toUpperCase();
    const session = await Session.findOne({ sessionId })
      .populate("participants.userId", "name email avatar")
      .lean();

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    const ranked = session.participants
      .filter((p) => p.report && p.report.turns > 0)
      .map((p) => ({
        rank:         0,
        userId:       p.userId?._id ?? p.userId,
        name:         p.name,
        overallScore: p.report.overallScore ?? 0,
        fluency:      p.report.fluency      ?? 0,
        relevance:    p.report.relevance    ?? 0,
        confidence:   p.report.confidence   ?? 0,
        fillerWords:  p.report.fillerWords  ?? 0,
        turns:        p.report.turns        ?? 0,
        badge:        getBadge(p.report.overallScore ?? 0),
      }))
      .sort((a, b) => b.overallScore - a.overallScore)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    res.json({
      success: true,
      sessionId,
      topic:       session.topic,
      leaderboard: ranked,
      total:       ranked.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch leaderboard." });
  }
});

// ── GET /api/reports/:sessionId — Full session report ────────────────────────
router.get("/:sessionId", async (req, res) => {
  try {
    const sessionId = req.params.sessionId.toUpperCase();
    const session = await Session.findOne({ sessionId })
      .populate("hostId", "name email")
      .populate("participants.userId", "name email avatar")
      .lean();

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    // Enrich each participant's report with auto-generated feedback
    const participants = session.participants.map((p) => {
      const report = p.report ?? {};
      return {
        userId:   p.userId?._id ?? p.userId,
        name:     p.name,
        email:    p.email,
        joinedAt: p.joinedAt,
        leftAt:   p.leftAt,
        isActive: p.isActive,
        report: {
          ...report,
          autoFeedback:  report.turns > 0 ? generateFeedback({ ...report }) : "No data recorded.",
          badge:         getBadge(report.overallScore ?? 0),
          // Peer rating aggregates
          peerScore:     report.peerScore     ?? null,
          peerFeedback:  report.peerFeedback  ?? "",
          combinedScore: report.combinedScore ?? null,
        },
      };
    });

    res.json({
      success: true,
      session: {
        sessionId:         session.sessionId,
        type:              session.type,
        topic:             session.topic,
        topicSource:       session.topicSource,
        status:            session.status,
        host:              session.hostId,
        duration:          session.duration,
        durationFormatted: formatDuration(session.duration),
        startedAt:         session.startedAt,
        endedAt:           session.endedAt,
        participants,
        summary:           aggregateReports(participants.map((p) => p.report)),
      },
    });
  } catch (err) {
    console.error("[reports] GET error:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch report." });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds = 0) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getBadge(score) {
  if (score >= 9.0) return { label: "Outstanding",  emoji: "🏆", color: "gold"   };
  if (score >= 8.0) return { label: "Excellent",    emoji: "⭐", color: "green"  };
  if (score >= 7.0) return { label: "Good",         emoji: "👍", color: "blue"   };
  if (score >= 5.5) return { label: "Average",      emoji: "📈", color: "yellow" };
  return               { label: "Needs Work",   emoji: "💪", color: "red"    };
}

export default router;
