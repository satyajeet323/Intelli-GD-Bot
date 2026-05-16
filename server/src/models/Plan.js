/**
 * Plan.js — Subscription plans managed by admins.
 */

import { mongoose } from "../db.js";

const planSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", maxlength: 1000 },
    price: {
      monthly:  { type: Number, default: 0 },
      yearly:   { type: Number, default: 0 },
      currency: { type: String, default: "USD" },
    },
    features: [{ type: String, maxlength: 200 }],
    limits: {
      sessionsPerMonth:  { type: Number, default: -1 }, // -1 = unlimited
      aiSessionsPerDay:  { type: Number, default: -1 },
      maxParticipants:   { type: Number, default: 12 },
      historyRetainDays: { type: Number, default: 30 },
      apiCallsPerDay:    { type: Number, default: -1 },
      storageGB:         { type: Number, default: 1 },
    },
    isActive:  { type: Boolean, default: true },
    isPublic:  { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    color:     { type: String, default: "#6366f1" },
    badge:     { type: String, default: "" }, // e.g. "Most Popular"
    userCount: { type: Number, default: 0 },  // denormalized count
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

export const Plan = mongoose.model("Plan", planSchema);
