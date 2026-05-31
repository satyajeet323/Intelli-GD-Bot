/**
 * UserNotification.js — Per-user notification delivery & read state.
 * One document per (user, notification) pair.
 */

import { mongoose } from "../db.js";

const userNotificationSchema = new mongoose.Schema(
  {
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: "Notification", required: true },
    isRead:         { type: Boolean, default: false },
    isDismissed:    { type: Boolean, default: false },
    readAt:         { type: Date, default: null },
    dismissedAt:    { type: Date, default: null },
    deliveredAt:    { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userNotificationSchema.index({ userId: 1, isRead: 1 });
userNotificationSchema.index({ userId: 1, notificationId: 1 }, { unique: true });
userNotificationSchema.index({ notificationId: 1 });

export const UserNotification = mongoose.model("UserNotification", userNotificationSchema);
