/**
 * sessionStore.js — In-memory store for real-time WebSocket sessions.
 *
 * This is the single source of truth for WHO is currently connected via
 * WebSocket. MongoDB stores persistent history; this store tracks live state.
 *
 * Session shape:
 * {
 *   id:           string          — session ID (e.g. "ABCD-EFGH-IJKL")
 *   topic:        string
 *   topicSource:  "gemini"|"local"
 *   createdAt:    Date
 *   participants: Map<socketId, Participant>   — keyed by socket ID
 *   userIndex:    Map<userId,   string>        — userId → current socketId
 *   cleanupTimer: Timeout|null
 * }
 *
 * Participant shape:
 * {
 *   socketId:     string
 *   userId:       string|null     — MongoDB user ID (if authenticated)
 *   name:         string
 *   audioEnabled: boolean
 *   videoEnabled: boolean
 *   screenSharing:boolean
 *   isSpeaking:   boolean
 *   joinedAt:     Date
 * }
 *
 * Deduplication guarantee:
 *   An authenticated user (userId != null) can only have ONE active entry in
 *   the participants Map at any time. If they reconnect with a new socket, the
 *   old socket entry is removed and replaced with the new one. This prevents
 *   ghost/duplicate tiles when a user refreshes or reconnects.
 */

const sessions = new Map();
const TTL_MS   = (parseInt(process.env.SESSION_TTL_SECONDS ?? "300", 10)) * 1000;

// ── Session CRUD ──────────────────────────────────────────────────────────────

export function createSession(id, topic, topicSource) {
  if (sessions.has(id)) return sessions.get(id); // idempotent
  const session = {
    id,
    topic,
    topicSource,
    createdAt:    new Date(),
    participants: new Map(), // socketId → Participant
    userIndex:    new Map(), // userId   → socketId  (authenticated users only)
    cleanupTimer: null,
  };
  sessions.set(id, session);
  console.log(`[store] Created: ${id} | source: ${topicSource}`);
  return session;
}

export function getSession(id) {
  return sessions.get(id) ?? null;
}

export function sessionExists(id) {
  return sessions.has(id);
}

export function deleteSession(id) {
  const s = sessions.get(id);
  if (s?.cleanupTimer) clearTimeout(s.cleanupTimer);
  sessions.delete(id);
  console.log(`[store] Deleted: ${id}`);
}

export function getAllSessions() {
  return [...sessions.values()].map(serializeSession);
}

// ── Participant management ────────────────────────────────────────────────────

/**
 * Add a participant to a session.
 *
 * Deduplication: if an authenticated user (userId != null) is already in the
 * session under a different socket ID (e.g. they refreshed), the old entry is
 * silently removed before the new one is inserted. This keeps the Map clean
 * and prevents ghost tiles.
 *
 * Returns the new participant object, or null if session not found.
 * Also returns the evicted old socketId (if any) so the caller can notify
 * other peers to drop the stale connection.
 */
export function addParticipant(sessionId, socketId, name, userId = null) {
  const session = sessions.get(sessionId);
  if (!session) return { participant: null, evictedSocketId: null };

  // Cancel pending cleanup — someone just joined
  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
    session.cleanupTimer = null;
  }

  // ── Deduplication by userId ───────────────────────────────────────────────
  // If this authenticated user already has an active socket in this session,
  // remove the old entry so they don't appear twice.
  let evictedSocketId = null;
  if (userId) {
    const existingSocketId = session.userIndex.get(userId);
    if (existingSocketId && existingSocketId !== socketId) {
      // Old socket is stale — remove it
      session.participants.delete(existingSocketId);
      evictedSocketId = existingSocketId;
      console.log(
        `[store] evict stale socket ${existingSocketId} for user ${userId} in ${sessionId}`
      );
    }
    // Update the index to point to the new socket
    session.userIndex.set(userId, socketId);
  }

  const participant = {
    socketId,
    userId,
    name,
    audioEnabled:  true,
    videoEnabled:  true,
    screenSharing: false,
    isSpeaking:    false,
    joinedAt:      new Date(),
  };
  session.participants.set(socketId, participant);
  console.log(
    `[store] +join ${name} (${socketId}) → ${sessionId} | total: ${session.participants.size}`
  );
  return { participant, evictedSocketId };
}

/**
 * Remove a participant from a session.
 * Schedules session cleanup if it becomes empty.
 */
export function removeParticipant(sessionId, socketId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const p = session.participants.get(socketId);
  if (!p) return;

  session.participants.delete(socketId);

  // Only remove from userIndex if this socket is still the current one.
  // If the user reconnected (new socket), the index already points to the
  // new socket — don't clobber it.
  if (p.userId && session.userIndex.get(p.userId) === socketId) {
    session.userIndex.delete(p.userId);
  }

  console.log(
    `[store] -left ${p.name} (${socketId}) ← ${sessionId} | remaining: ${session.participants.size}`
  );

  if (session.participants.size === 0) {
    session.cleanupTimer = setTimeout(() => {
      const s = sessions.get(sessionId);
      if (s && s.participants.size === 0) {
        deleteSession(sessionId);
        console.log(`[store] Auto-cleaned empty session: ${sessionId}`);
      }
    }, TTL_MS);
  }
}

/**
 * Patch any fields on a participant (audioEnabled, videoEnabled, etc.)
 */
export function updateParticipantState(sessionId, socketId, patch) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const p = session.participants.get(socketId);
  if (!p) return null;
  Object.assign(p, patch);
  return p;
}

/**
 * Get a single participant by socketId.
 */
export function getParticipant(sessionId, socketId) {
  return sessions.get(sessionId)?.participants.get(socketId) ?? null;
}

/**
 * Get the current socketId for an authenticated user in a session.
 * Returns null if the user is not in the session or is a guest.
 */
export function getSocketIdForUser(sessionId, userId) {
  if (!userId) return null;
  return sessions.get(sessionId)?.userIndex.get(userId) ?? null;
}

// ── Serialisation ─────────────────────────────────────────────────────────────

export function serializeParticipant(p) {
  return {
    socketId:      p.socketId,
    userId:        p.userId,
    name:          p.name,
    audioEnabled:  p.audioEnabled,
    videoEnabled:  p.videoEnabled,
    screenSharing: p.screenSharing,
    isSpeaking:    p.isSpeaking,
    joinedAt:      p.joinedAt,
  };
}

export function serializeSession(session) {
  return {
    id:               session.id,
    topic:            session.topic,
    topicSource:      session.topicSource,
    createdAt:        session.createdAt,
    participantCount: session.participants.size,
    participants:     [...session.participants.values()].map(serializeParticipant),
  };
}
