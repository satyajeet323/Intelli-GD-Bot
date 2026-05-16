/**
 * socketHandler.js — Complete real-time WebRTC signalling system.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CLIENT → SERVER                                                        │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  join-session      { sessionId, name, userId? }                         │
 * │  leave-session     { sessionId? }                                       │
 * │  webrtc-offer      { targetSocketId, sdp }                              │
 * │  webrtc-answer     { targetSocketId, sdp }                              │
 * │  webrtc-ice        { targetSocketId, candidate }                        │
 * │  toggle-audio      { enabled }                                          │
 * │  toggle-video      { enabled }                                          │
 * │  toggle-screen     { enabled }                                          │
 * │  speaking          { isSpeaking }                                       │
 * │  chat-message      { text }                                             │
 * │  ping              —                                                    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  SERVER → CLIENT                                                        │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  session-joined    { session, you, peers[] }                            │
 * │  session-error     { code, message }                                    │
 * │  peer-joined       { participant }          → all others in room        │
 * │  peer-left         { socketId, name }       → all others in room        │
 * │  room-roster       { participants[] }       → all in room               │
 * │  webrtc-offer      { fromSocketId, sdp }    → target only               │
 * │  webrtc-answer     { fromSocketId, sdp }    → target only               │
 * │  webrtc-ice        { fromSocketId, candidate } → target only            │
 * │  peer-updated      { socketId, ...state }   → all in room               │
 * │  chat-message      { id, senderId, senderName, text, ts } → all in room │
 * │  pong              { ts }                   → sender only               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Security rules:
 *  - WebRTC signals are ONLY forwarded if both sender and target are in the
 *    SAME session. Cross-session signalling is silently dropped.
 *  - Chat messages are ONLY broadcast within the sender's current session.
 *  - All events that require a session check silently no-op if the socket
 *    is not in a session.
 */

import { v4 as uuidv4 } from "uuid";
import {
  getSession,
  sessionExists,
  addParticipant,
  removeParticipant,
  updateParticipantState,
  getParticipant,
  serializeSession,
  serializeParticipant,
} from "./sessionStore.js";
import { Session } from "./models/Session.js";

// ── Rate limiting (simple in-memory) ─────────────────────────────────────────
const MESSAGE_LIMIT   = 30;   // max messages per window
const MESSAGE_WINDOW  = 10000; // 10 seconds
const messageCounters = new Map(); // socketId → { count, resetAt }

function isRateLimited(socketId) {
  const now  = Date.now();
  const entry = messageCounters.get(socketId) ?? { count: 0, resetAt: now + MESSAGE_WINDOW };

  if (now > entry.resetAt) {
    entry.count   = 0;
    entry.resetAt = now + MESSAGE_WINDOW;
  }

  entry.count++;
  messageCounters.set(socketId, entry);
  return entry.count > MESSAGE_LIMIT;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export function registerSocketHandlers(io, socket) {
  // Verified identity from JWT middleware (null for unauthenticated guests)
  const authedUser = socket.data.user ?? null; // { id, name, email } | null

  console.log(
    `[ws] +connect ${socket.id} | user: ${authedUser?.email ?? "guest"} | ip: ${socket.handshake.address}`
  );

  // Per-socket state
  let currentSessionId = null;
  let currentName      = null;
  let currentUserId    = null;

  // ── Helper: emit error to this socket ──────────────────────────────────────
  const emitError = (code, message) => {
    socket.emit("session-error", { code, message });
    console.warn(`[ws] error → ${socket.id}: [${code}] ${message}`);
  };

  // ── Helper: broadcast updated roster to everyone in the room ───────────────
  const broadcastRoster = (sessionId) => {
    const session = getSession(sessionId);
    if (!session) return;
    const roster = [...session.participants.values()].map(serializeParticipant);
    io.to(sessionId).emit("room-roster", { participants: roster });
  };

  // ── Helper: verify sender is in the same session as target ─────────────────
  const sameSession = (targetSocketId) => {
    if (!currentSessionId) return false;
    const target = getParticipant(currentSessionId, targetSocketId);
    return !!target;
  };

  // ── join-session ────────────────────────────────────────────────────────────
  socket.on("join-session", ({ sessionId, name, userId } = {}) => {
    // Input validation
    if (!sessionId || typeof sessionId !== "string") {
      return emitError("MISSING_SESSION_ID", "sessionId is required.");
    }

    const sid = sessionId.trim().toUpperCase();

    // Prefer verified JWT identity; fall back to client-supplied values for guests
    const resolvedName   = authedUser?.name   ?? (name?.trim() || null);
    const resolvedUserId = authedUser?.id      ?? (userId       || null);

    if (!resolvedName) {
      return emitError("MISSING_NAME", "name is required.");
    }

    // Session must exist in the in-memory store
    if (!sessionExists(sid)) {
      return emitError(
        "SESSION_NOT_FOUND",
        `Session "${sid}" not found. Create it first or check the ID.`
      );
    }

    // If already in a different session, leave it first
    if (currentSessionId && currentSessionId !== sid) {
      handleLeave(io, socket, currentSessionId, currentName);
    }

    // Add to in-memory store — deduplicates by userId automatically.
    // evictedSocketId is set when the same authenticated user had a stale
    // socket entry (e.g. they refreshed before the old socket disconnected).
    const { participant, evictedSocketId } = addParticipant(
      sid, socket.id, resolvedName, resolvedUserId
    );
    if (!participant) {
      return emitError("JOIN_FAILED", "Failed to join session.");
    }

    // If a stale socket was evicted, tell all peers to drop it so they
    // don't keep a ghost tile for the old connection.
    if (evictedSocketId) {
      io.to(sid).emit("peer-left", {
        socketId: evictedSocketId,
        name:     resolvedName,
        reason:   "reconnected",
      });
      console.log(`[ws] notified peers to drop stale socket ${evictedSocketId} (user reconnected)`);
    }

    currentSessionId = sid;
    currentName      = resolvedName;
    currentUserId    = resolvedUserId;

    // Join the Socket.io room (isolates broadcasts to this session)
    socket.join(sid);

    const session = getSession(sid);

    // Build list of existing peers (everyone except the new joiner)
    const peers = [...session.participants.values()]
      .filter((p) => p.socketId !== socket.id)
      .map(serializeParticipant);

    // ① Tell the new joiner: here's the session + all existing peers
    socket.emit("session-joined", {
      session:     serializeSession(session),
      you:         serializeParticipant(participant),
      peers,       // new joiner uses this to initiate WebRTC offers to each peer
    });

    // ② Tell everyone else: a new peer joined (they will wait for an offer)
    socket.to(sid).emit("peer-joined", {
      participant: serializeParticipant(participant),
    });

    // ③ Broadcast updated roster to all (including new joiner)
    broadcastRoster(sid);

    // ④ Persist participant to MongoDB so they appear in history.
    //    Use resolvedUserId/resolvedName (JWT-verified) not raw client payload.
    //    Use findOneAndUpdate with $addToSet-style upsert to prevent duplicates:
    //    if the user is already in participants, update their record;
    //    otherwise push a new entry. We do this with two operations:
    //    first try to update an existing entry, then push if not found.
    if (resolvedUserId) {
      const now = new Date();
      // Try to reactivate an existing entry first (handles rejoin after leave)
      Session.findOneAndUpdate(
        { sessionId: sid, "participants.userId": resolvedUserId },
        {
          $set: {
            "participants.$.isActive": true,
            "participants.$.leftAt":   null,
            "participants.$.name":     resolvedName,
            status: "active",
          },
        }
      ).then((updated) => {
        if (!updated) {
          // No existing entry — add a new one
          return Session.findOneAndUpdate(
            { sessionId: sid },
            {
              $push: {
                participants: {
                  userId:   resolvedUserId,
                  name:     resolvedName,
                  joinedAt: now,
                  isActive: true,
                },
              },
              $set: { status: "active" },
            }
          );
        }
      }).catch((err) => console.error("[ws] participant persist error:", err.message));
    }

    console.log(
      `[ws] ${resolvedName} joined ${sid} | peers: ${peers.length} | total: ${session.participants.size}`
    );
  });

  // ── leave-session ───────────────────────────────────────────────────────────
  socket.on("leave-session", ({ sessionId } = {}) => {
    const sid = sessionId?.trim().toUpperCase() ?? currentSessionId;
    if (!sid) return;
    handleLeave(io, socket, sid, currentName);
    if (sid === currentSessionId) {
      currentSessionId = null;
      currentName      = null;
      currentUserId    = null;
    }
  });

  // ── webrtc-offer ────────────────────────────────────────────────────────────
  // Initiator sends SDP offer to a specific peer
  socket.on("webrtc-offer", ({ targetSocketId, sdp } = {}) => {
    if (!targetSocketId || !sdp) return;
    if (!sameSession(targetSocketId)) {
      return emitError("CROSS_SESSION", "Target is not in your session.");
    }
    io.to(targetSocketId).emit("webrtc-offer", {
      fromSocketId: socket.id,
      fromName:     currentName,
      sdp,
    });
    console.log(`[ws] offer ${socket.id} → ${targetSocketId}`);
  });

  // ── webrtc-answer ───────────────────────────────────────────────────────────
  // Receiver sends SDP answer back to the initiator
  socket.on("webrtc-answer", ({ targetSocketId, sdp } = {}) => {
    if (!targetSocketId || !sdp) return;
    if (!sameSession(targetSocketId)) {
      return emitError("CROSS_SESSION", "Target is not in your session.");
    }
    io.to(targetSocketId).emit("webrtc-answer", {
      fromSocketId: socket.id,
      sdp,
    });
    console.log(`[ws] answer ${socket.id} → ${targetSocketId}`);
  });

  // ── webrtc-ice ──────────────────────────────────────────────────────────────
  // Both sides exchange ICE candidates
  socket.on("webrtc-ice", ({ targetSocketId, candidate } = {}) => {
    if (!targetSocketId || !candidate) return;
    if (!sameSession(targetSocketId)) return; // silently drop cross-session ICE
    io.to(targetSocketId).emit("webrtc-ice", {
      fromSocketId: socket.id,
      candidate,
    });
  });

  // ── toggle-audio ────────────────────────────────────────────────────────────
  socket.on("toggle-audio", ({ enabled } = {}) => {
    if (!currentSessionId) return;
    updateParticipantState(currentSessionId, socket.id, { audioEnabled: !!enabled });
    io.to(currentSessionId).emit("peer-updated", {
      socketId:     socket.id,
      audioEnabled: !!enabled,
    });
  });

  // ── toggle-video ────────────────────────────────────────────────────────────
  socket.on("toggle-video", ({ enabled } = {}) => {
    if (!currentSessionId) return;
    updateParticipantState(currentSessionId, socket.id, { videoEnabled: !!enabled });
    io.to(currentSessionId).emit("peer-updated", {
      socketId:     socket.id,
      videoEnabled: !!enabled,
    });
  });

  // ── toggle-screen ───────────────────────────────────────────────────────────
  socket.on("toggle-screen", ({ enabled } = {}) => {
    if (!currentSessionId) return;
    updateParticipantState(currentSessionId, socket.id, { screenSharing: !!enabled });
    io.to(currentSessionId).emit("peer-updated", {
      socketId:      socket.id,
      screenSharing: !!enabled,
    });
  });

  // ── speaking ────────────────────────────────────────────────────────────────
  // Client sends this when Web Audio API detects voice activity
  socket.on("speaking", ({ isSpeaking } = {}) => {
    if (!currentSessionId) return;
    updateParticipantState(currentSessionId, socket.id, { isSpeaking: !!isSpeaking });
    // Broadcast to others only (sender already knows they're speaking)
    socket.to(currentSessionId).emit("peer-updated", {
      socketId:   socket.id,
      isSpeaking: !!isSpeaking,
    });
  });

  // ── chat-message ────────────────────────────────────────────────────────────
  socket.on("chat-message", ({ text } = {}) => {
    if (!currentSessionId) return;
    if (!text || typeof text !== "string" || !text.trim()) return;

    // Rate limit chat messages
    if (isRateLimited(socket.id)) {
      return emitError("RATE_LIMITED", "You are sending messages too fast.");
    }

    const participant = getParticipant(currentSessionId, socket.id);
    if (!participant) return;

    // Use stable userId as senderId so the frontend can reliably identify
    // "my own" messages across reconnects. Fall back to socket.id for guests.
    const senderId   = participant.userId ?? socket.id;
    const senderName = participant.name;

    const msg = {
      id:         uuidv4(),
      senderId,           // stable: userId (MongoDB _id) or socket.id for guests
      senderName,
      text:       text.trim().slice(0, 2000), // hard cap
      ts:         Date.now(),
    };

    // Broadcast to everyone in the session (including sender for confirmation)
    io.to(currentSessionId).emit("chat-message", msg);

    // Persist to MongoDB asynchronously (non-blocking)
    Session.findOneAndUpdate(
      { sessionId: currentSessionId },
      { $push: { messages: { senderId, senderName, text: msg.text } } }
    ).catch((err) => console.error("[ws] chat persist error:", err.message));
  });

  // ── ping / pong ─────────────────────────────────────────────────────────────
  socket.on("ping", () => {
    socket.emit("pong", { ts: Date.now() });
  });

  // ── disconnect ──────────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    console.log(`[ws] -disconnect ${socket.id} (${reason})`);
    messageCounters.delete(socket.id);
    if (currentSessionId) {
      handleLeave(io, socket, currentSessionId, currentName);
    }
  });

  // ── error ───────────────────────────────────────────────────────────────────
  socket.on("error", (err) => {
    console.error(`[ws] socket error ${socket.id}:`, err.message);
  });
}

// ── Shared leave logic ────────────────────────────────────────────────────────

function handleLeave(io, socket, sessionId, name) {
  if (!sessionId) return;

  // Get userId before removing from in-memory store
  const leavingParticipant = getParticipant(sessionId, socket.id);
  const userId = leavingParticipant?.userId ?? null;

  removeParticipant(sessionId, socket.id);
  socket.leave(sessionId);

  // Notify remaining participants
  io.to(sessionId).emit("peer-left", {
    socketId: socket.id,
    name:     name ?? "Unknown",
  });

  // Broadcast updated roster to remaining participants
  const session = getSession(sessionId);
  const remainingCount = session?.participants.size ?? 0;

  if (session) {
    const roster = [...session.participants.values()].map(serializeParticipant);
    io.to(sessionId).emit("room-roster", { participants: roster });
  }

  // Persist leave to MongoDB
  if (userId) {
    const now = new Date();
    if (remainingCount === 0) {
      // Last person left — end the session
      Session.findOneAndUpdate(
        { sessionId, status: { $ne: "ended" } },
        {
          $set: {
            status:  "ended",
            endedAt: now,
          },
          $inc: { duration: 0 }, // will be recalculated below
        }
      ).then(async (doc) => {
        if (doc) {
          const duration = Math.round((now - doc.startedAt) / 1000);
          await Session.updateOne(
            { sessionId },
            {
              $set: {
                duration,
                "participants.$[p].isActive": false,
                "participants.$[p].leftAt":   now,
              },
            },
            { arrayFilters: [{ "p.isActive": true }] }
          );
          console.log(`[ws] Session ${sessionId} ended | duration: ${duration}s`);
        }
      }).catch((err) => console.error("[ws] session end persist error:", err.message));
    } else {
      // Mark ALL entries for this participant as left (handles duplicate entries)
      Session.updateOne(
        { sessionId },
        {
          $set: {
            "participants.$[p].isActive": false,
            "participants.$[p].leftAt":   now,
          },
        },
        { arrayFilters: [{ "p.userId": userId, "p.isActive": true }] }
      ).catch((err) => console.error("[ws] participant leave persist error:", err.message));
    }
  }

  console.log(`[ws] ${name ?? socket.id} left ${sessionId} | remaining: ${remainingCount}`);
}
