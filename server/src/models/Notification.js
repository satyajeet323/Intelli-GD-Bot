/**
 * Notification.js — Admin-created notifications/announcements.
 */

import { mongoose } from "../db.js";

const notificationSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, maxlength: 200 },
    message:     { type: String, required: true, maxlength: 5000 },
    type:        { type: String, enum: ["announcement", "alert", "maintenance", "promotion", "system"], default: "announcement" },
    priority:    { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    targetType:  { type: String, enum: ["all", "plan", "specific"], default: "all" },
    targetPlan:  { type: String, enum: ["free", "pro", "enterprise", ""], default: "" },
    targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status:      { type: String, enum: ["draft", "scheduled", "sent", "cancelled"], default: "draft" },
    scheduledAt: { type: Date, default: null },
    sentAt:      { type: Date, default: null },
    sentCount:   { type: Number, default: 0 },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
    expiresAt:   { type: Date, default: null },
    // Banner config
    isBanner:    { type: Boolean, default: false },
    bannerColor: { type: String, default: "" },
    isDismissible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);
