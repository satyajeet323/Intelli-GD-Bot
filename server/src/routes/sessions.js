/**
 * sessions.js — Group Discussion Session REST API
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Endpoint                          │ Auth │ Description                 │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  POST   /api/sessions              │  ✓   │ Create new session          │
 * │  GET    /api/sessions              │  ✓   │ List user's active sessions │
 * │  GET    /api/sessions/:id          │  —   │ Get session details         │
 * │  GET    /api/sessions/:id/validate │  —   │ Check session exists        │
 * │  POST   /api/sessions/:id/join     │  ✓   │ Join a session              │
 * │  POST   /api/sessions/:id/leave    │  ✓   │ Leave a session             │
 * │  GET    /api/sessions/:id/participants │ — │ List participants           │
 * │  POST   /api/sessions/:id/end      │  ✓   │ End session (host only)     │
 * │  DELETE /api/sessions/:id          │  ✓   │ Delete session (host only)  │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { Router } from "express";
import { body, param } from "express-validator";
import { Session } from "../models/Session.js";
import { generateTopic } from "../topics.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createSession, sessionExists } from "../sessionStore.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a unique XXXX-XXXX-XXXX session ID */
function makeSessionId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [4, 4, 4]
    .map((len) =>
      Array.from({ length: len }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("")
    )
    .join("-");
}

/** Ensure the generated ID doesn't already exist in MongoDB */
async function generateUniqueSessionId() {
  let id;
  let attempts = 0;
  do {
    id = makeSessionId();
    attempts++;
    if (attempts > 10) throw new Error("Could not generate unique session ID");
  } while (await Session.exists({ sessionId: id }));
  return id;
}

// ── POST /api/sessions — Create a new session ─────────────────────────────────
router.post(
  "/",
  requireAuth,
  [
    body("type")
      .optional()
      .isIn(["individual", "group"])
      .withMessage("type must be 'individual' or 'group'"),
    body("maxParticipants")
      .optional()
      .toInt()
      .isInt({ min: 1, max: 50 })
      .withMessage("maxParticipants must be between 1 and 50"),
    body("topic")
      .optional()
      .customSanitizer((v) => (typeof v === "string" ? v.trim() : v))
      .isString()
      .isLength({ min: 5, max: 500 })
      .withMessage("topic must be 5–500 characters"),
  ],
  validate,
  async (req, res) => {
    try {
      const { type = "group", maxParticipants = 12, topic: customTopic } = req.body;

      // Generate unique session ID
      const sessionId = await generateUniqueSessionId();

      // Generate topic (AI-first, local fallback) unless host provided one
      let topic, topicSource;
      if (customTopic) {
        topic = customTopic.trim();
        topicSource = "local";
      } else {
        ({ topic, source: topicSource } = await generateTopic());
      }

      // Host is automatically the first participant
      const session = await Session.create({
        sessionId,
        type,
        topic,
        topicSource,
        hostId: req.user.id,
        maxParticipants,
        status: "waiting",
        participants: [
          {
            userId:   req.user.id,
            name:     req.user.name,
            email:    req.user.email,
            joinedAt: new Date(),
            isActive: true,
          },
        ],
      });

      // Register in in-memory store for real-time WebSocket use
      createSession(sessionId, topic, topicSource);

      console.log(
        `[sessions] Created: ${sessionId} | type: ${type} | topic source: ${topicSource} | host: ${req.user.email}`
      );

      res.status(201).json({
        success: true,
        message: "Session created successfully.",
        session: {
          sessionId:       session.sessionId,
          type:            session.type,
          topic:           session.topic,
          topicSource:     session.topicSource,
          status:          session.status,
          maxParticipants: session.maxParticipants,
          participantCount: 1,
          startedAt:       session.startedAt,
        },
      });
    } catch (err) {
      console.error("[sessions] Create error:", err.message);
      res.status(500).json({ success: false, message: "Failed to create session." });
    }
  }
);

// ── GET /api/sessions — List active sessions for current user ─────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const sessions = await Session.find({
      status: { $in: ["waiting", "active"] },
      $or: [
        { hostId: req.user.id },
        { "participants.userId": req.user.id },
      ],
    })
      .select("sessionId type topic status maxParticipants participants startedAt hostId")
      .populate("hostId", "name email")
      .lean();

    const result = sessions.map((s) => ({
      sessionId:        s.sessionId,
      type:             s.type,
      topic:            s.topic,
      status:           s.status,
      maxParticipants:  s.maxParticipants,
      participantCount: s.participants.filter((p) => p.isActive).length,
      host:             s.hostId,
      startedAt:        s.startedAt,
    }));

    res.json({ success: true, sessions: result });
  } catch (err) {
    console.error("[sessions] List error:", err.message);
    res.status(500).json({ success: false, message: "Failed to list sessions." });
  }
});

// ── GET /api/sessions/:id/validate — Check if session ID exists ───────────────
// NOTE: must be before /:id to avoid being swallowed by the catch-all
router.get(
  "/:id/validate",
  [param("id").trim().notEmpty().withMessage("Session ID is required")],
  validate,
  async (req, res) => {
    try {
      const sessionId = req.params.id.toUpperCase();

      // Check both in-memory store (real-time) and MongoDB (persistent)
      const inMemory = sessionExists(sessionId);
      const inDB = await Session.exists({ sessionId, status: { $ne: "ended" } });

      res.json({ success: true, valid: !!(inMemory || inDB) });
    } catch (err) {
      res.status(500).json({ success: false, message: "Validation check failed." });
    }
  }
);

// ── GET /api/sessions/:id/participants — List participants ────────────────────
router.get("/:id/participants", async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id.toUpperCase() })
      .populate("participants.userId", "name email avatar")
      .lean();

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    // Deduplicate by userId — keep the entry with the most recent joinedAt
    // (handles race condition where socket + REST both added the same user)
    const participantMap = new Map();
    for (const p of session.participants) {
      const uid = String(p.userId?._id ?? p.userId);
      const existing = participantMap.get(uid);
      if (!existing || new Date(p.joinedAt) > new Date(existing.joinedAt)) {
        participantMap.set(uid, p);
      }
    }

    const participants = [...participantMap.values()].map((p) => ({
      userId:   p.userId?._id ?? p.userId,
      name:     p.name,
      email:    p.email,
      joinedAt: p.joinedAt,
      leftAt:   p.leftAt,
      isActive: p.isActive,
    }));

    res.json({
      success: true,
      sessionId: session.sessionId,
      total:     participants.length,
      active:    participants.filter((p) => p.isActive).length,
      participants,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch participants." });
  }
});

// ── GET /api/sessions/:id — Get full session details ─────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id.toUpperCase() })
      .populate("hostId", "name email")
      .populate("participants.userId", "name email avatar")
      .lean();

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch session." });
  }
});

// ── POST /api/sessions/:id/join — Join a session ─────────────────────────────
router.post(
  "/:id/join",
  requireAuth,
  [param("id").trim().notEmpty().withMessage("Session ID is required")],
  validate,
  async (req, res) => {
    try {
      const sessionId = req.params.id.toUpperCase();
      const session = await Session.findOne({ sessionId });

      // ── Validation checks ──────────────────────────────────────────────────

      if (!session) {
        return res.status(404).json({
          success: false,
          message: `Session "${sessionId}" not found. Check the ID and try again.`,
        });
      }

      if (session.status === "ended") {
        return res.status(410).json({
          success: false,
          message: "This session has already ended.",
        });
      }

      // Check if user is already an active participant
      if (session.hasActiveParticipant(req.user.id)) {
        // Idempotent — return success if already in session
        return res.json({
          success: true,
          message: "You are already in this session.",
          alreadyJoined: true,
          session: {
            sessionId:       session.sessionId,
            topic:           session.topic,
            status:          session.status,
            participantCount: session.participants.filter((p) => p.isActive).length,
          },
        });
      }

      // Check capacity
      if (session.isFull()) {
        return res.status(409).json({
          success: false,
          message: `Session is full (max ${session.maxParticipants} participants).`,
        });
      }

      // ── Add participant ────────────────────────────────────────────────────

      // If user previously left, reactivate their entry instead of duplicating
      const existingIdx = session.participants.findIndex(
        (p) => p.userId.toString() === req.user.id
      );

      if (existingIdx !== -1) {
        // Rejoin — update existing entry
        session.participants[existingIdx].isActive = true;
        session.participants[existingIdx].leftAt   = null;
        session.participants[existingIdx].joinedAt = new Date();
      } else {
        // First time joining
        session.participants.push({
          userId:   req.user.id,
          name:     req.user.name,
          email:    req.user.email,
          joinedAt: new Date(),
          isActive: true,
        });
      }

      // Activate session when first non-host joins
      if (session.status === "waiting" && session.participants.filter((p) => p.isActive).length >= 2) {
        session.status = "active";
      }

      await session.save();

      const activeCount = session.participants.filter((p) => p.isActive).length;

      console.log(
        `[sessions] ${req.user.email} joined ${sessionId} | active: ${activeCount}/${session.maxParticipants}`
      );

      res.json({
        success: true,
        message: "Joined session successfully.",
        session: {
          sessionId:        session.sessionId,
          topic:            session.topic,
          topicSource:      session.topicSource,
          type:             session.type,
          status:           session.status,
          maxParticipants:  session.maxParticipants,
          participantCount: activeCount,
          startedAt:        session.startedAt,
        },
        participant: {
          userId:   req.user.id,
          name:     req.user.name,
          joinedAt: new Date(),
        },
      });
    } catch (err) {
      console.error("[sessions] Join error:", err.message);
      res.status(500).json({ success: false, message: "Failed to join session." });
    }
  }
);

// ── POST /api/sessions/:id/leave — Leave a session ───────────────────────────
router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.id.toUpperCase();
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    const participant = session.participants.find(
      (p) => p.userId.toString() === req.user.id && p.isActive
    );

    if (!participant) {
      return res.status(400).json({
        success: false,
        message: "You are not an active participant in this session.",
      });
    }

    // Mark ALL entries for this user as left (handles duplicate entries from socket/REST)
    session.participants.forEach((p) => {
      if (p.userId.toString() === req.user.id) {
        p.isActive = false;
        p.leftAt   = new Date();
      }
    });

    // If no active participants remain, end the session
    const remaining = session.participants.filter((p) => p.isActive).length;
    if (remaining === 0) {
      session.status   = "ended";
      session.endedAt  = new Date();
      session.duration = Math.round((session.endedAt - session.startedAt) / 1000);
    }

    await session.save();

    console.log(
      `[sessions] ${req.user.email} left ${sessionId} | remaining: ${remaining}`
    );

    res.json({
      success: true,
      message: "Left session successfully.",
      remainingParticipants: remaining,
      sessionEnded: remaining === 0,
    });
  } catch (err) {
    console.error("[sessions] Leave error:", err.message);
    res.status(500).json({ success: false, message: "Failed to leave session." });
  }
});

// ── POST /api/sessions/:id/end — End a session (host or self for individual) ──
router.post("/:id/end", requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.id.toUpperCase();
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    // Individual sessions can be ended by the participant themselves.
    // Group sessions can only be ended by the host.
    const isHost = session.hostId.toString() === req.user.id;
    const isParticipant = session.participants.some(
      (p) => p.userId?.toString() === req.user.id
    );
    const canEnd = isHost || (session.type === "individual" && isParticipant);

    if (!canEnd) {
      return res.status(403).json({
        success: false,
        message: "Only the session host can end the session.",
      });
    }

    if (session.status === "ended") {
      return res.status(400).json({ success: false, message: "Session already ended." });
    }

    session.status   = "ended";
    session.endedAt  = new Date();
    session.duration = Math.round((session.endedAt - session.startedAt) / 1000);

    // Mark all participants as left
    session.participants.forEach((p) => {
      if (p.isActive) {
        p.isActive = false;
        p.leftAt   = session.endedAt;
      }
    });

    await session.save();

    console.log(
      `[sessions] Ended: ${sessionId} | duration: ${session.durationFormatted}`
    );

    res.json({
      success: true,
      message: "Session ended.",
      session: {
        sessionId:  session.sessionId,
        status:     session.status,
        duration:   session.duration,
        durationFormatted: session.durationFormatted,
        endedAt:    session.endedAt,
      },
    });
  } catch (err) {
    console.error("[sessions] End error:", err.message);
    res.status(500).json({ success: false, message: "Failed to end session." });
  }
});

// ── DELETE /api/sessions/:id — Delete session (host only) ────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.id.toUpperCase();
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    if (session.hostId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the session host can delete the session.",
      });
    }

    await Session.deleteOne({ sessionId });
    console.log(`[sessions] Deleted: ${sessionId}`);

    res.json({ success: true, message: "Session deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete session." });
  }
});

export default router;
