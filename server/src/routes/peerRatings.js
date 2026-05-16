/**
 * peerRatings.js — Peer evaluation API for ended group sessions.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Endpoint                                    │ Auth │ Description        │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │  POST /api/peer-ratings/:sessionId           │  ✓   │ Submit all ratings │
 * │  GET  /api/peer-ratings/:sessionId           │  ✓   │ Get ratings for me │
 * │  GET  /api/peer-ratings/:sessionId/status    │  ✓   │ Submission status  │
 * │  GET  /api/peer-ratings/:sessionId/summary   │  ✓   │ Aggregated results │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Rules enforced:
 *  - Session must be ended (status === "ended")
 *  - Rater must have been a participant
 *  - Cannot rate yourself
 *  - Must rate every other participant (all-or-nothing submission)
 *  - Duplicate submission is rejected (idempotent check)
 *  - After submission, peer aggregates are recalculated and written back
 *    to each participant's report.peerScore / peerFeedback / combinedScore
 */

import { Router }       from "express";
import { body, param }  from "express-validator";
import { Session }      from "../models/Session.js";
import { requireAuth }  from "../middleware/auth.js";
import { validate }     from "../middleware/validate.js";
import { clamp }        from "../lib/scoreCalculator.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a 1–5 peer criterion score to a 0–10 scale.
 */
function toTen(v) {
  return clamp((v - 1) * (10 / 4)); // 1→0, 3→5, 5→10
}

/**
 * Aggregate all peer ratings received by a single ratee and return
 * averaged scores on the 0–10 scale plus a text summary.
 */
function aggregatePeerRatings(ratings) {
  if (!ratings.length) return null;

  const avg = (key) =>
    parseFloat(
      (ratings.reduce((s, r) => s + toTen(r[key]), 0) / ratings.length).toFixed(2)
    );

  const communication = avg("communication");
  const relevance     = avg("relevance");
  const confidence    = avg("confidence");
  const clarity       = avg("clarity");

  // Weighted peer score: communication 30%, relevance 25%, confidence 25%, clarity 20%
  const peerScore = clamp(
    communication * 0.30 +
    relevance     * 0.25 +
    confidence    * 0.25 +
    clarity       * 0.20
  );

  // Collect non-empty comments
  const comments = ratings
    .map((r) => r.comment?.trim())
    .filter(Boolean);

  // Generate a short text summary
  const lines = [];
  if (peerScore >= 8)      lines.push("Peers rated your overall contribution as outstanding.");
  else if (peerScore >= 6) lines.push("Peers found your contribution solid and well-structured.");
  else if (peerScore >= 4) lines.push("Peers noted room for improvement in your contribution.");
  else                     lines.push("Peers felt your contribution needed more depth and clarity.");

  if (communication >= 7)  lines.push("Your communication style was praised as clear and engaging.");
  else if (communication < 5) lines.push("Work on making your communication more structured and concise.");

  if (clarity >= 7)        lines.push("Your points were expressed with good clarity.");
  else if (clarity < 5)    lines.push("Try to articulate your ideas more clearly.");

  if (comments.length)     lines.push(`Peer comments: "${comments.slice(0, 2).join('" · "')}"`);

  return {
    peerScore,
    communication,
    relevance,
    confidence,
    clarity,
    raterCount:   ratings.length,
    peerFeedback: lines.join(" "),
    comments,
  };
}

/**
 * Recalculate and persist peer aggregates for every participant in a session.
 * Called after any new rating batch is submitted.
 */
async function refreshPeerAggregates(session) {
  // Build a map of userId → participant entry with the most report data
  // to handle duplicate entries from socket/REST race conditions
  const participantMap = new Map();
  for (const participant of session.participants) {
    const uid = participant.userId.toString();
    if (!participantMap.has(uid) || (participant.report?.turns ?? 0) >= (participantMap.get(uid).report?.turns ?? 0)) {
      participantMap.set(uid, participant);
    }
  }

  for (const [uid, participant] of participantMap) {
    const received = session.peerRatings.filter(
      (r) => r.rateeId.toString() === uid
    );

    if (!received.length) continue;

    const agg = aggregatePeerRatings(received);
    if (!agg) continue;

    participant.report.peerScore    = agg.peerScore;
    participant.report.peerFeedback = agg.peerFeedback;

    // Combined score: 60% AI/self score + 40% peer score
    const selfScore = participant.report.overallScore ?? 0;
    participant.report.combinedScore = clamp(selfScore * 0.60 + agg.peerScore * 0.40);
  }

  // Mark all mutated paths so Mongoose includes them in the save
  session.markModified("participants");
  session.markModified("peerRatings");
  session.markModified("peerRatingSubmitters");
  await session.save();
}

// ── POST /api/peer-ratings/:sessionId — Submit all ratings at once ────────────
router.post(
  "/:sessionId",
  requireAuth,
  [
    param("sessionId").trim().notEmpty().withMessage("sessionId is required"),
    body("ratings")
      .isArray({ min: 1 })
      .withMessage("ratings must be a non-empty array"),
    body("ratings.*.rateeId")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Each rating must have a rateeId"),
    body("ratings.*.communication")
      .toInt()
      .isInt({ min: 1, max: 5 })
      .withMessage("communication must be 1–5"),
    body("ratings.*.relevance")
      .toInt()
      .isInt({ min: 1, max: 5 })
      .withMessage("relevance must be 1–5"),
    body("ratings.*.confidence")
      .toInt()
      .isInt({ min: 1, max: 5 })
      .withMessage("confidence must be 1–5"),
    body("ratings.*.clarity")
      .toInt()
      .isInt({ min: 1, max: 5 })
      .withMessage("clarity must be 1–5"),
    body("ratings.*.comment")
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .isLength({ max: 500 })
      .withMessage("comment must be under 500 characters"),
  ],
  validate,
  async (req, res) => {
    try {
      const sessionId = req.params.sessionId.toUpperCase();
      const raterId   = req.user.id;
      const { ratings } = req.body;

      const session = await Session.findOne({ sessionId });
      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found." });
      }

      // Only ended or active sessions accept peer ratings
      // (a user can leave while others are still in the session)
      if (session.status === "waiting") {
        return res.status(400).json({
          success: false,
          message: "Peer ratings can only be submitted after the session has started.",
        });
      }

      // Rater must have been a participant
      const raterParticipant = session.participants.find(
        (p) => p.userId.toString() === raterId
      );
      if (!raterParticipant) {
        return res.status(403).json({
          success: false,
          message: "You were not a participant in this session.",
        });
      }

      // Duplicate submission check
      const alreadySubmitted = session.peerRatingSubmitters.some(
        (id) => id.toString() === raterId
      );
      if (alreadySubmitted) {
        return res.status(409).json({
          success: false,
          message: "You have already submitted your peer ratings for this session.",
        });
      }

      // Build the set of valid ratee IDs (all unique userIds except the rater).
      // Deduplicate by userId — a user may have multiple participant entries
      // if they joined via both REST and socket (race condition on connect).
      const validRateeIds = [
        ...new Set(
          session.participants
            .map((p) => p.userId.toString())
            .filter((uid) => uid !== raterId)
        ),
      ];

      // Validate: no self-rating, no unknown participants
      for (const r of ratings) {
        if (r.rateeId === raterId) {
          return res.status(400).json({
            success: false,
            message: "You cannot rate yourself.",
          });
        }
        if (!validRateeIds.includes(r.rateeId)) {
          return res.status(400).json({
            success: false,
            message: `Ratee "${r.rateeId}" is not a participant in this session.`,
          });
        }
      }

      // Validate: must rate ALL other participants (all-or-nothing)
      // Deduplicate submitted rateeIds in case client sent duplicates
      const ratedIds = [...new Set(ratings.map((r) => r.rateeId))];
      if (ratedIds.length !== validRateeIds.length) {
        return res.status(400).json({
          success: false,
          message: `You must rate all ${validRateeIds.length} other participant(s). Received ratings for ${ratedIds.length}.`,
        });
      }

      // Persist one rating per unique ratee (skip duplicates from client)
      for (const rateeId of ratedIds) {
        const r = ratings.find((x) => x.rateeId === rateeId);
        const rateeParticipant = session.participants.find(
          (p) => p.userId.toString() === rateeId
        );
        session.peerRatings.push({
          raterId:       raterId,
          raterName:     raterParticipant.name,
          rateeId:       rateeId,
          rateeName:     rateeParticipant?.name ?? "Unknown",
          communication: parseInt(r.communication, 10),
          relevance:     parseInt(r.relevance,     10),
          confidence:    parseInt(r.confidence,    10),
          clarity:       parseInt(r.clarity,       10),
          comment:       r.comment?.trim() ?? "",
          submittedAt:   new Date(),
        });
      }

      // Mark this rater as having submitted
      session.peerRatingSubmitters.push(raterId);

      // Explicitly mark both arrays as modified so Mongoose detects the
      // in-place mutations and includes them in the next save() call.
      session.markModified("peerRatings");
      session.markModified("peerRatingSubmitters");

      // Recalculate peer aggregates for all participants and save
      await refreshPeerAggregates(session);

      console.log(
        `[peer-ratings] ${req.user.email} submitted ${ratings.length} rating(s) for session ${sessionId}`
      );

      res.status(201).json({
        success: true,
        message: "Peer ratings submitted successfully.",
        submitted: ratings.length,
      });
    } catch (err) {
      console.error("[peer-ratings] POST error:", err.message);
      res.status(500).json({ success: false, message: "Failed to submit peer ratings." });
    }
  }
);

// ── GET /api/peer-ratings/:sessionId/status — Submission status ───────────────
// Returns who has submitted and whether the current user has submitted.
router.get(
  "/:sessionId/status",
  requireAuth,
  async (req, res) => {
    try {
      const sessionId = req.params.sessionId.toUpperCase();
      const userId    = req.user.id;

      const session = await Session.findOne({ sessionId })
        .select("sessionId status participants peerRatingSubmitters peerRatings")
        .lean();

      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found." });
      }

      // Deduplicate participants by userId for accurate counts
      const uniqueParticipants = [
        ...new Map(
          session.participants.map((p) => [p.userId.toString(), p])
        ).values(),
      ];
      const totalParticipants = uniqueParticipants.length;
      const submitterCount    = session.peerRatingSubmitters?.length ?? 0;
      const hasSubmitted      = session.peerRatingSubmitters?.some(
        (id) => id.toString() === userId
      ) ?? false;

      // Participants who still need to rate (excluding self)
      const pendingIds = uniqueParticipants
        .filter((p) => {
          const pid = p.userId.toString();
          return pid !== userId &&
            !session.peerRatingSubmitters?.some((s) => s.toString() === pid);
        })
        .map((p) => p.name);

      res.json({
        success: true,
        sessionId,
        status:           session.status,
        totalParticipants,
        submitterCount,
        hasSubmitted,
        pendingParticipants: pendingIds,
        allSubmitted: submitterCount >= totalParticipants,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to fetch rating status." });
    }
  }
);

// ── GET /api/peer-ratings/:sessionId — Ratings received by the current user ───
router.get(
  "/:sessionId",
  requireAuth,
  async (req, res) => {
    try {
      const sessionId = req.params.sessionId.toUpperCase();
      const userId    = req.user.id;

      const session = await Session.findOne({ sessionId })
        .select("sessionId topic status participants peerRatings peerRatingSubmitters")
        .lean();

      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found." });
      }

      // Verify the user was a participant
      const isParticipant = session.participants.some(
        (p) => p.userId.toString() === userId
      );
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: "You were not a participant in this session.",
        });
      }

      // Ratings this user received (anonymised — no rater identity exposed)
      const received = (session.peerRatings ?? [])
        .filter((r) => r.rateeId.toString() === userId)
        .map((r) => ({
          communication: r.communication,
          relevance:     r.relevance,
          confidence:    r.confidence,
          clarity:       r.clarity,
          comment:       r.comment,
          submittedAt:   r.submittedAt,
        }));

      const agg = aggregatePeerRatings(received);

      // My own participant record for combined score
      const me = session.participants.find((p) => p.userId.toString() === userId);

      res.json({
        success: true,
        sessionId,
        topic:        session.topic,
        hasSubmitted: session.peerRatingSubmitters?.some((id) => id.toString() === userId) ?? false,
        received: {
          count:         received.length,
          aggregate:     agg,
          peerScore:     me?.report?.peerScore    ?? null,
          peerFeedback:  me?.report?.peerFeedback ?? "",
          combinedScore: me?.report?.combinedScore ?? null,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to fetch peer ratings." });
    }
  }
);

// ── GET /api/peer-ratings/:sessionId/summary — Full session peer summary ──────
// Returns aggregated peer scores for all participants (visible to all members).
router.get(
  "/:sessionId/summary",
  requireAuth,
  async (req, res) => {
    try {
      const sessionId = req.params.sessionId.toUpperCase();
      const userId    = req.user.id;

      const session = await Session.findOne({ sessionId })
        .select("sessionId topic status participants peerRatings peerRatingSubmitters")
        .lean();

      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found." });
      }

      const isParticipant = session.participants.some(
        (p) => p.userId.toString() === userId
      );
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: "You were not a participant in this session.",
        });
      }

      // Deduplicate participants by userId — use the entry with the most data
      const participantMap = new Map();
      for (const p of session.participants) {
        const uid = p.userId.toString();
        if (!participantMap.has(uid) || (p.report?.turns ?? 0) > (participantMap.get(uid).report?.turns ?? 0)) {
          participantMap.set(uid, p);
        }
      }
      const uniqueParticipants = [...participantMap.values()];

      const participantSummaries = uniqueParticipants.map((p) => {
        const pid      = p.userId.toString();
        const received = (session.peerRatings ?? []).filter(
          (r) => r.rateeId.toString() === pid
        );
        const agg = aggregatePeerRatings(received);
        return {
          userId:        pid,
          name:          p.name,
          isMe:          pid === userId,
          peerScore:     p.report?.peerScore     ?? null,
          combinedScore: p.report?.combinedScore ?? null,
          raterCount:    received.length,
          breakdown:     agg
            ? {
                communication: agg.communication,
                relevance:     agg.relevance,
                confidence:    agg.confidence,
                clarity:       agg.clarity,
              }
            : null,
        };
      });

      // Sort by combined score descending
      participantSummaries.sort(
        (a, b) => (b.combinedScore ?? 0) - (a.combinedScore ?? 0)
      );

      res.json({
        success: true,
        sessionId,
        topic:              session.topic,
        totalParticipants:  session.participants.length,
        submitterCount:     session.peerRatingSubmitters?.length ?? 0,
        participants:       participantSummaries,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to fetch peer summary." });
    }
  }
);

export default router;
