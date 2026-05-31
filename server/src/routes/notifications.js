/**
 * notifications.js — User-facing notification endpoints.
 * Authenticated users can fetch, mark-read, and dismiss their notifications.
 */

import { Router } from "express";
import { Notification }     from "../models/Notification.js";
import { UserNotification } from "../models/UserNotification.js";
import { User }             from "../models/User.js";
import { requireAuth }      from "../middleware/auth.js";

const router = Router();

// Enrich req.user with full DB record (plan, role, etc.)
async function enrichUser(req, res, next) {
  try {
    const full = await User.findById(req.user.id).select("_id plan role").lean();
    if (!full) return res.status(401).json({ success: false, message: "User not found." });
    req.user = { ...req.user, _id: full._id, plan: full.plan, role: full.role };
    next();
  } catch {
    res.status(500).json({ success: false, message: "Auth error." });
  }
}

// Apply both middlewares to all routes
router.use(requireAuth, enrichUser);

// ── GET /api/notifications ────────────────────────────────────────────────────
// Returns notifications relevant to the current user (active + sent, not expired)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const page   = Math.max(1, parseInt(req.query.page  ?? "1"));
    const limit  = Math.min(50, parseInt(req.query.limit ?? "20"));
    const unreadOnly = req.query.unread === "true";

    // Find notifications targeted at this user
    const now = new Date();
    const notifFilter = {
      status: { $in: ["sent", "active"] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      $and: [
        {
          $or: [
            { targetType: "all" },
            { targetType: "plan",     targetPlan: req.user.plan },
            { targetType: "role",     targetRole: req.user.role ?? "user" },
            { targetType: "specific", targetUsers: userId },
          ],
        },
      ],
    };

    const notifications = await Notification.find(notifFilter)
      .sort({ createdAt: -1 })
      .lean();

    const notifIds = notifications.map((n) => n._id);

    // Fetch user-specific state for these notifications
    const userStates = await UserNotification.find({
      userId,
      notificationId: { $in: notifIds },
    }).lean();

    const stateMap = new Map(userStates.map((s) => [s.notificationId.toString(), s]));

    // Merge state into notifications
    let merged = notifications.map((n) => {
      const state = stateMap.get(n._id.toString());
      return {
        ...n,
        isRead:      state?.isRead      ?? false,
        isDismissed: state?.isDismissed ?? false,
        readAt:      state?.readAt      ?? null,
        deliveredAt: state?.deliveredAt ?? n.sentAt,
      };
    });

    // Filter out dismissed
    merged = merged.filter((n) => !n.isDismissed);

    if (unreadOnly) merged = merged.filter((n) => !n.isRead);

    const total   = merged.length;
    const unread  = merged.filter((n) => !n.isRead).length;
    const paged   = merged.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      notifications: paged,
      unreadCount: unread,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[notifications] GET /", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch notifications." });
  }
});

// ── GET /api/notifications/unread-count ───────────────────────────────────────
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const now    = new Date();

    const notifFilter = {
      status: { $in: ["sent", "active"] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      $and: [{
        $or: [
          { targetType: "all" },
          { targetType: "plan",     targetPlan: req.user.plan },
          { targetType: "role",     targetRole: req.user.role ?? "user" },
          { targetType: "specific", targetUsers: userId },
        ],
      }],
    };

    const notifications = await Notification.find(notifFilter).select("_id").lean();
    const notifIds = notifications.map((n) => n._id);

    const readOrDismissed = await UserNotification.countDocuments({
      userId,
      notificationId: { $in: notifIds },
      $or: [{ isRead: true }, { isDismissed: true }],
    });

    const unreadCount = Math.max(0, notifIds.length - readOrDismissed);

    res.json({ success: true, unreadCount });
  } catch {
    res.status(500).json({ success: false, message: "Failed to get unread count." });
  }
});

// ── POST /api/notifications/:id/read ─────────────────────────────────────────
router.post("/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const notifId = req.params.id;

    const existing = await UserNotification.findOne({ userId, notificationId: notifId });
    const wasUnread = !existing?.isRead;

    await UserNotification.findOneAndUpdate(
      { userId, notificationId: notifId },
      { $set: { isRead: true, readAt: new Date() } },
      { upsert: true }
    );

    // Increment readCount on the notification (best-effort, only once per user)
    if (wasUnread) {
      await Notification.findByIdAndUpdate(notifId, { $inc: { readCount: 1 } });
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: "Failed to mark as read." });
  }
});

// ── POST /api/notifications/read-all ─────────────────────────────────────────
router.post("/read-all", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const now    = new Date();

    const notifFilter = {
      status: { $in: ["sent", "active"] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      $and: [{
        $or: [
          { targetType: "all" },
          { targetType: "plan",     targetPlan: req.user.plan },
          { targetType: "role",     targetRole: req.user.role ?? "user" },
          { targetType: "specific", targetUsers: userId },
        ],
      }],
    };

    const notifications = await Notification.find(notifFilter).select("_id").lean();
    const notifIds = notifications.map((n) => n._id);

    // Upsert read state for all
    const ops = notifIds.map((id) => ({
      updateOne: {
        filter: { userId, notificationId: id },
        update: { $set: { isRead: true, readAt: new Date() } },
        upsert: true,
      },
    }));

    if (ops.length) await UserNotification.bulkWrite(ops);

    res.json({ success: true, count: ops.length });
  } catch {
    res.status(500).json({ success: false, message: "Failed to mark all as read." });
  }
});

// ── POST /api/notifications/:id/dismiss ──────────────────────────────────────
router.post("/:id/dismiss", requireAuth, async (req, res) => {
  try {
    const userId  = req.user._id;
    const notifId = req.params.id;

    await UserNotification.findOneAndUpdate(
      { userId, notificationId: notifId },
      { $set: { isDismissed: true, dismissedAt: new Date(), isRead: true, readAt: new Date() } },
      { upsert: true }
    );

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: "Failed to dismiss notification." });
  }
});

// ── DELETE /api/notifications/clear ──────────────────────────────────────────
router.delete("/clear", requireAuth, async (req, res) => {
  try {
    await UserNotification.updateMany(
      { userId: req.user._id },
      { $set: { isDismissed: true, dismissedAt: new Date() } }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: "Failed to clear notifications." });
  }
});

export default router;
