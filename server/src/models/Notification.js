/**
 * Notification.js — Admin-created notifications/announcements.
 */

import { mongoose } from "../db.js";

const notificationSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, maxlength: 200 },
    message:     { type: String, required: true, maxlength: 5000 },
    type: {
      type: String,
      enum: ["announcement", "alert", "maintenance", "promotion", "system",
             "security", "feature", "custom"],
      default: "announcement",
    },
    priority:    { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    targetType:  { type: String, enum: ["all", "plan", "role", "specific"], default: "all" },
    targetPlan:  { type: String, enum: ["free", "pro", "enterprise", ""], default: "" },
    targetRole:  { type: String, enum: ["user", "admin", ""], default: "" },
    targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status:      { type: String, enum: ["draft", "active", "scheduled", "sent", "cancelled"], default: "draft" },
    scheduledAt: { type: Date, default: null },
    expiresAt:   { type: Date, default: null },
    sentAt:      { type: Date, default: null },
    sentCount:   { type: Number, default: 0 },
    readCount:   { type: Number, default: 0 },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
    // Banner / display config
    isBanner:      { type: Boolean, default: false },
    bannerColor:   { type: String, default: "" },
    isDismissible: { type: Boolean, default: true },
    // Action link
    actionUrl:   { type: String, default: "" },
    actionLabel: { type: String, default: "" },
    // Audit
    updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ status: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ scheduledAt: 1 });
notificationSchema.index({ expiresAt: 1 });

export const Notification = mongoose.model("Notification", notificationSchema);
