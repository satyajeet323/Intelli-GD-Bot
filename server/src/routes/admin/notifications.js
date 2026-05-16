/**
 * admin/notifications.js — Notification management.
 */

import { Router } from "express";
import { body }   from "express-validator";
import { Notification } from "../../models/Notification.js";
import { User }         from "../../models/User.js";
import { requirePermission, audit } from "../../middleware/adminAuth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();

// GET /api/admin/notifications
router.get("/", requirePermission("notifications.view"), async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  ?? "1"));
    const limit  = Math.min(100, parseInt(req.query.limit ?? "20"));
    const status = req.query.status ?? "";
    const type   = req.query.type   ?? "";

    const filter = {};
    if (status) filter.status = status;
    if (type)   filter.type   = type;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("createdBy", "name email")
        .lean(),
      Notification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch notifications." });
  }
});

// POST /api/admin/notifications
router.post(
  "/",
  requirePermission("notifications.create"),
  [
    body("title").trim().notEmpty().isLength({ max: 200 }),
    body("message").trim().notEmpty().isLength({ max: 5000 }),
    body("type").optional().isIn(["announcement", "alert", "maintenance", "promotion", "system"]),
    body("priority").optional().isIn(["low", "medium", "high", "critical"]),
    body("targetType").optional().isIn(["all", "plan", "specific"]),
    body("scheduledAt").optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const notif = await Notification.create({
        ...req.body,
        createdBy: req.admin._id,
        status: req.body.scheduledAt ? "scheduled" : "draft",
      });

      await audit(req, `Created notification: ${notif.title}`, "notifications", {
        targetType: "Notification", targetId: notif._id.toString(), targetName: notif.title,
      });

      res.status(201).json({ success: true, notification: notif });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to create notification." });
    }
  }
);

// POST /api/admin/notifications/:id/send
router.post("/:id/send", requirePermission("notifications.send"), async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ success: false, message: "Notification not found." });
    if (notif.status === "sent") return res.status(400).json({ success: false, message: "Already sent." });

    // Count recipients
    let sentCount = 0;
    if (notif.targetType === "all") {
      sentCount = await User.countDocuments();
    } else if (notif.targetType === "plan" && notif.targetPlan) {
      sentCount = await User.countDocuments({ plan: notif.targetPlan });
    } else if (notif.targetType === "specific") {
      sentCount = notif.targetUsers.length;
    }

    notif.status    = "sent";
    notif.sentAt    = new Date();
    notif.sentCount = sentCount;
    await notif.save();

    // Emit via Socket.io if available
    const io = req.app.get("io");
    if (io) {
      io.emit("admin-notification", {
        id:       notif._id,
        title:    notif.title,
        message:  notif.message,
        type:     notif.type,
        priority: notif.priority,
        sentAt:   notif.sentAt,
      });
    }

    await audit(req, `Sent notification: ${notif.title}`, "notifications", {
      targetType: "Notification", targetId: notif._id.toString(), targetName: notif.title,
      details: { sentCount },
    });

    res.json({ success: true, notification: notif, sentCount });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send notification." });
  }
});

// PATCH /api/admin/notifications/:id
router.patch("/:id", requirePermission("notifications.create"), async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ success: false, message: "Not found." });
    if (notif.status === "sent") return res.status(400).json({ success: false, message: "Cannot edit sent notifications." });

    Object.assign(notif, req.body);
    await notif.save();

    res.json({ success: true, notification: notif });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update notification." });
  }
});

// DELETE /api/admin/notifications/:id
router.delete("/:id", requirePermission("notifications.delete"), async (req, res) => {
  try {
    const notif = await Notification.findByIdAndDelete(req.params.id);
    if (!notif) return res.status(404).json({ success: false, message: "Not found." });

    await audit(req, `Deleted notification: ${notif.title}`, "notifications", {
      targetType: "Notification", targetId: notif._id.toString(), targetName: notif.title,
    });

    res.json({ success: true, message: "Deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete notification." });
  }
});

export default router;
