/**
 * admin/notifications.js — Full notification management with analytics,
 * scheduling, targeting, real-time delivery, and read receipts.
 *
 * Route order matters: /stats and other literal paths MUST come before /:id
 * to prevent Express matching "stats" as a MongoDB ObjectId parameter.
 */

import { Router } from "express";
import { body }   from "express-validator";
import { Notification }     from "../../models/Notification.js";
import { UserNotification } from "../../models/UserNotification.js";
import { User }             from "../../models/User.js";
import { requirePermission, audit } from "../../middleware/adminAuth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUserFilter(notif) {
  if (notif.targetType === "plan"     && notif.targetPlan)          return { plan: notif.targetPlan };
  if (notif.targetType === "role"     && notif.targetRole)          return { role: notif.targetRole };
  if (notif.targetType === "specific" && notif.targetUsers?.length) return { _id: { $in: notif.targetUsers } };
  return {};
}

async function deliverNotification(notif, io) {
  const users = await User.find(buildUserFilter(notif)).select("_id").lean();
  if (!users.length) return 0;

  const docs = users.map((u) => ({ userId: u._id, notificationId: notif._id, deliveredAt: new Date() }));
  await UserNotification.insertMany(docs, { ordered: false }).catch(() => {});

  if (io) {
    const payload = {
      id: notif._id, title: notif.title, message: notif.message,
      type: notif.type, priority: notif.priority,
      isBanner: notif.isBanner, isDismissible: notif.isDismissible,
      actionUrl: notif.actionUrl, actionLabel: notif.actionLabel, sentAt: notif.sentAt,
    };
    if (notif.targetType === "all") {
      io.emit("notification", payload);
    } else {
      const userIds = new Set(users.map((u) => u._id.toString()));
      for (const [, socket] of io.sockets.sockets) {
        const uid = socket.data?.user?.id;
        if (uid && userIds.has(uid)) socket.emit("notification", payload);
      }
    }
  }
  return users.length;
}

// ── GET / — list with pagination + filters ────────────────────────────────────
router.get("/", requirePermission("notifications.view"), async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page     ?? "1"));
    const limit    = Math.min(100, parseInt(req.query.limit  ?? "20"));
    const status   = req.query.status   ?? "";
    const type     = req.query.type     ?? "";
    const priority = req.query.priority ?? "";
    const search   = req.query.search   ?? "";

    const filter = {};
    if (status)   filter.status   = status;
    if (type)     filter.type     = type;
    if (priority) filter.priority = priority;
    if (search)   filter.title    = { $regex: search, $options: "i" };

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate("createdBy", "name email").lean(),
      Notification.countDocuments(filter),
    ]);

    res.json({ success: true, notifications, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch notifications." });
  }
});

// ── GET /stats — aggregate counts (MUST be before /:id) ──────────────────────
router.get("/stats", requirePermission("notifications.view"), async (req, res) => {
  try {
    const [total, sent, draft, scheduled, active, cancelled,
           totalDelivered, totalRead, byType, byPriority] = await Promise.all([
      Notification.countDocuments(),
      Notification.countDocuments({ status: "sent" }),
      Notification.countDocuments({ status: "draft" }),
      Notification.countDocuments({ status: "scheduled" }),
      Notification.countDocuments({ status: "active" }),
      Notification.countDocuments({ status: "cancelled" }),
      UserNotification.countDocuments(),
      UserNotification.countDocuments({ isRead: true }),
      Notification.aggregate([{ $group: { _id: "$type",     count: { $sum: 1 } } }]),
      Notification.aggregate([{ $group: { _id: "$priority", count: { $sum: 1 } } }]),
    ]);

    res.json({
      success: true,
      stats: {
        total, sent, draft, scheduled, active, cancelled,
        totalDelivered, totalRead,
        readRate: totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0,
        byType:     Object.fromEntries(byType.map((x) => [x._id, x.count])),
        byPriority: Object.fromEntries(byPriority.map((x) => [x._id, x.count])),
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch stats." });
  }
});

// ── POST / — create ───────────────────────────────────────────────────────────
router.post(
  "/",
  requirePermission("notifications.create"),
  [
    body("title").trim().notEmpty().isLength({ max: 200 }),
    body("message").trim().notEmpty().isLength({ max: 5000 }),
    body("type").optional().isIn(["announcement","alert","maintenance","promotion","system","security","feature","custom"]),
    body("priority").optional().isIn(["low","medium","high","critical"]),
    body("targetType").optional().isIn(["all","plan","role","specific"]),
    // nullable: true allows null values; the .if guard skips ISO check when empty/null
    body("scheduledAt").optional({ nullable: true }).if(body("scheduledAt").notEmpty()).isISO8601(),
    body("expiresAt").optional({ nullable: true }).if(body("expiresAt").notEmpty()).isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const data = { ...req.body };
      if (!data.scheduledAt) data.scheduledAt = null;
      if (!data.expiresAt)   data.expiresAt   = null;

      const notif = await Notification.create({
        ...data,
        createdBy: req.admin._id,
        status: data.scheduledAt ? "scheduled" : "draft",
      });

      console.log(`[notif] Created "${notif.title}" status=${notif.status} scheduledAt=${notif.scheduledAt?.toISOString() ?? "null"}`);

      await audit(req, `Created notification: ${notif.title}`, "notifications", {
        targetType: "Notification", targetId: notif._id.toString(), targetName: notif.title,
      });

      res.status(201).json({ success: true, notification: notif });
    } catch (err) {
      console.error("[notif] create:", err.message);
      res.status(500).json({ success: false, message: "Failed to create notification." });
    }
  }
);

// ── GET /:id/analytics ────────────────────────────────────────────────────────
router.get("/:id/analytics", requirePermission("notifications.view"), async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id).lean();
    if (!notif) return res.status(404).json({ success: false, message: "Not found." });

    const [delivered, read, dismissed] = await Promise.all([
      UserNotification.countDocuments({ notificationId: notif._id }),
      UserNotification.countDocuments({ notificationId: notif._id, isRead: true }),
      UserNotification.countDocuments({ notificationId: notif._id, isDismissed: true }),
    ]);

    res.json({
      success: true,
      analytics: {
        delivered, read, dismissed,
        readRate:    delivered > 0 ? Math.round((read      / delivered) * 100) : 0,
        dismissRate: delivered > 0 ? Math.round((dismissed / delivered) * 100) : 0,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch analytics." });
  }
});

// ── POST /:id/send ────────────────────────────────────────────────────────────
router.post("/:id/send", requirePermission("notifications.send"), async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif)                       return res.status(404).json({ success: false, message: "Notification not found." });
    if (notif.status === "sent")      return res.status(400).json({ success: false, message: "Already sent." });
    if (notif.status === "cancelled") return res.status(400).json({ success: false, message: "Cannot send a cancelled notification." });

    notif.sentAt = new Date();
    notif.status = "sent";
    await notif.save();

    const io = req.app.get("io");
    const sentCount = await deliverNotification(notif, io);
    notif.sentCount = sentCount;
    await notif.save();

    await audit(req, `Sent notification: ${notif.title}`, "notifications", {
      targetType: "Notification", targetId: notif._id.toString(), targetName: notif.title,
      details: { sentCount },
    });

    res.json({ success: true, notification: notif, sentCount });
  } catch {
    res.status(500).json({ success: false, message: "Failed to send notification." });
  }
});

// ── POST /:id/activate ────────────────────────────────────────────────────────
router.post("/:id/activate", requirePermission("notifications.send"), async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif)                       return res.status(404).json({ success: false, message: "Not found." });
    if (notif.status === "cancelled") return res.status(400).json({ success: false, message: "Cannot activate a cancelled notification." });

    notif.status = "active";
    notif.sentAt = notif.sentAt ?? new Date();
    await notif.save();

    const io = req.app.get("io");
    await deliverNotification(notif, io);

    await audit(req, `Activated notification: ${notif.title}`, "notifications", {
      targetType: "Notification", targetId: notif._id.toString(), targetName: notif.title,
    });

    res.json({ success: true, notification: notif });
  } catch {
    res.status(500).json({ success: false, message: "Failed to activate notification." });
  }
});

// ── POST /:id/deactivate ──────────────────────────────────────────────────────
router.post("/:id/deactivate", requirePermission("notifications.send"), async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ success: false, message: "Not found." });

    notif.status = "cancelled";
    await notif.save();

    const io = req.app.get("io");
    if (io) io.emit("notification-removed", { id: notif._id });

    await audit(req, `Deactivated notification: ${notif.title}`, "notifications", {
      targetType: "Notification", targetId: notif._id.toString(), targetName: notif.title,
    });

    res.json({ success: true, notification: notif });
  } catch {
    res.status(500).json({ success: false, message: "Failed to deactivate notification." });
  }
});

// ── PATCH /:id ────────────────────────────────────────────────────────────────
router.patch("/:id", requirePermission("notifications.create"), async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif)                  return res.status(404).json({ success: false, message: "Not found." });
    if (notif.status === "sent") return res.status(400).json({ success: false, message: "Cannot edit sent notifications." });

    const allowed = ["title","message","type","priority","targetType","targetPlan",
                     "targetRole","targetUsers","scheduledAt","expiresAt",
                     "isBanner","bannerColor","isDismissible","actionUrl","actionLabel"];
    for (const key of allowed) {
      if (key in req.body) {
        // Coerce empty string to null for date fields
        notif[key] = (key === "scheduledAt" || key === "expiresAt")
          ? (req.body[key] || null)
          : req.body[key];
      }
    }
    notif.updatedBy = req.admin._id;

    if (notif.status === "draft"     && notif.scheduledAt)  notif.status = "scheduled";
    if (notif.status === "scheduled" && !notif.scheduledAt) notif.status = "draft";

    await notif.save();

    await audit(req, `Updated notification: ${notif.title}`, "notifications", {
      targetType: "Notification", targetId: notif._id.toString(), targetName: notif.title,
    });

    res.json({ success: true, notification: notif });
  } catch {
    res.status(500).json({ success: false, message: "Failed to update notification." });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", requirePermission("notifications.delete"), async (req, res) => {
  try {
    const notif = await Notification.findByIdAndDelete(req.params.id);
    if (!notif) return res.status(404).json({ success: false, message: "Not found." });

    await UserNotification.deleteMany({ notificationId: notif._id });

    await audit(req, `Deleted notification: ${notif.title}`, "notifications", {
      targetType: "Notification", targetId: notif._id.toString(), targetName: notif.title,
    });

    res.json({ success: true, message: "Deleted." });
  } catch {
    res.status(500).json({ success: false, message: "Failed to delete notification." });
  }
});

export default router;
