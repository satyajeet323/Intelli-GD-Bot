/**
 * AuditLog.js — Immutable audit trail for all admin actions.
 */

import { mongoose } from "../db.js";

const auditLogSchema = new mongoose.Schema(
  {
    adminId:    { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
    adminName:  { type: String, required: true },
    adminEmail: { type: String, required: true },
    action:     { type: String, required: true, maxlength: 200 },
    category:   {
      type: String,
      enum: ["auth", "users", "roles", "sessions", "plans", "notifications", "system", "reports", "content", "topics", "ml", "config"],
      required: true,
    },
    targetType: { type: String, default: "" },   // e.g. "User", "Session"
    targetId:   { type: String, default: "" },   // the affected document id
    targetName: { type: String, default: "" },   // human-readable label
    details:    { type: mongoose.Schema.Types.Mixed, default: {} },
    ip:         { type: String, default: "" },
    userAgent:  { type: String, default: "" },
    severity:   { type: String, enum: ["info", "warning", "critical"], default: "info" },
  },
  {
    timestamps: true,
    // Audit logs are append-only — disable updates
    strict: true,
  }
);

// TTL: keep audit logs for 1 year
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
