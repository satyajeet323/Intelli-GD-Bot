/**
 * SystemConfig.js — Key-value system configuration store.
 */

import { mongoose } from "../db.js";

const systemConfigSchema = new mongoose.Schema(
  {
    key:         { type: String, required: true, unique: true, trim: true },
    value:       { type: mongoose.Schema.Types.Mixed, required: true },
    type:        { type: String, enum: ["string", "number", "boolean", "json"], default: "string" },
    category:    { type: String, enum: ["general", "security", "ai", "email", "storage", "feature", "rateLimit"], default: "general" },
    description: { type: String, default: "" },
    isSecret:    { type: Boolean, default: false },
    updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

export const SystemConfig = mongoose.model("SystemConfig", systemConfigSchema);
