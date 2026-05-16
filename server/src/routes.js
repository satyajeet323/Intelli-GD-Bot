/**
 * routes.js — REST API endpoints for session management.
 *
 * POST /api/sessions          — Create a new session (generates topic via AI)
 * GET  /api/sessions/:id      — Get session details + participant list
 * GET  /api/sessions/:id/validate — Check if a session ID exists (for Join flow)
 * GET  /api/sessions          — List all active sessions (admin/debug)
 * DELETE /api/sessions/:id    — Force-delete a session
 */

import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { generateTopic } from "./topics.js";
import {
  createSession,
  getSession,
  sessionExists,
  deleteSession,
  getAllSessions,
  serializeSession,
} from "./sessionStore.js";

const router = Router();

// ── POST /api/sessions ────────────────────────────────────────────────────────
router.post("/sessions", async (req, res) => {
  try {
    // Generate a human-readable session ID: XXXX-XXXX-XXXX
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const sessionId = [4, 4, 4]
      .map((len) =>
        Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
      )
      .join("-");

    // Generate topic (AI-first, local fallback)
    const { topic, source } = await generateTopic();

    const session = createSession(sessionId, topic, source);

    res.status(201).json({
      success: true,
      session: serializeSession(session),
    });
  } catch (err) {
    console.error("[routes] POST /sessions error:", err);
    res.status(500).json({ success: false, message: "Failed to create session." });
  }
});

// ── GET /api/sessions/:id ─────────────────────────────────────────────────────
router.get("/sessions/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, message: "Session not found." });
  }
  res.json({ success: true, session: serializeSession(session) });
});

// ── GET /api/sessions/:id/validate ───────────────────────────────────────────
router.get("/sessions/:id/validate", (req, res) => {
  const exists = sessionExists(req.params.id);
  res.json({ success: true, valid: exists });
});

// ── GET /api/sessions (debug) ─────────────────────────────────────────────────
router.get("/sessions", (req, res) => {
  res.json({ success: true, sessions: getAllSessions() });
});

// ── DELETE /api/sessions/:id ──────────────────────────────────────────────────
router.delete("/sessions/:id", (req, res) => {
  if (!sessionExists(req.params.id)) {
    return res.status(404).json({ success: false, message: "Session not found." });
  }
  deleteSession(req.params.id);
  res.json({ success: true, message: "Session deleted." });
});

export default router;
