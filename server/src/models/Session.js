/**
 * Session.js — MongoDB schema for group discussion sessions.
 */

import { mongoose } from "../db.js";

// ── Report sub-schema (per participant) ───────────────────────────────────────
const reportSchema = new mongoose.Schema(
  {
    fluency:      { type: Number, min: 0, max: 10, default: 0 },
    relevance:    { type: Number, min: 0, max: 10, default: 0 },
    confidence:   { type: Number, min: 0, max: 10, default: 0 },
    fillerWords:  { type: Number, default: 0 },
    turns:        { type: Number, default: 0 },
    overallScore: { type: Number, min: 0, max: 10, default: 0 },
    feedback:     { type: String, default: "" },
    aiFeedback:   { type: String, default: "" },
    // Peer-rating aggregates — populated after ratings are collected
    peerScore:    { type: Number, min: 0, max: 10, default: null },
    peerFeedback: { type: String, default: "" },
    combinedScore:{ type: Number, min: 0, max: 10, default: null },
  },
  { _id: false }
);

// ── Participant sub-schema ────────────────────────────────────────────────────
const participantSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name:         { type: String, required: true, trim: true },
    email:        { type: String, default: "" },
    joinedAt:     { type: Date, default: Date.now },
    leftAt:       { type: Date, default: null },
    isActive:     { type: Boolean, default: true },
    report:       { type: reportSchema, default: () => ({}) },
  },
  { _id: false }
);

// ── Message sub-schema ────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema(
  {
    senderId:   { type: String, required: true },
    senderName: { type: String, required: true },
    text:       { type: String, required: true, maxlength: 2000 },
    ts:         { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Peer rating sub-schema ────────────────────────────────────────────────────
// One document per rater→ratee pair per session.
const peerRatingSchema = new mongoose.Schema(
  {
    raterId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    raterName:     { type: String, required: true },
    rateeId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rateeName:     { type: String, required: true },
    // Four criteria, each 1–5
    communication: { type: Number, min: 1, max: 5, required: true },
    relevance:     { type: Number, min: 1, max: 5, required: true },
    confidence:    { type: Number, min: 1, max: 5, required: true },
    clarity:       { type: Number, min: 1, max: 5, required: true },
    comment:       { type: String, default: "", maxlength: 500 },
    submittedAt:   { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── Main session schema ───────────────────────────────────────────────────────
const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["individual", "group"],
      default: "group",
    },
    topic:        { type: String, required: true, trim: true },
    topicSource:  { type: String, enum: ["gemini", "local"], default: "local" },
    hostId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    maxParticipants: { type: Number, default: 12, min: 1, max: 50 },
    participants: { type: [participantSchema], default: [] },
    messages:     { type: [messageSchema], default: [] },
    peerRatings:  { type: [peerRatingSchema], default: [] },
    // Tracks which participants have submitted all their peer ratings
    peerRatingSubmitters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["waiting", "active", "ended"],
      default: "waiting",
    },
    startedAt: { type: Date, default: Date.now },
    endedAt:   { type: Date, default: null },
    duration:  { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

sessionSchema.virtual("durationFormatted").get(function () {
  const secs = this.duration ?? 0;
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
});

sessionSchema.virtual("activeParticipantCount").get(function () {
  return this.participants.filter((p) => p.isActive).length;
});

// ── Instance methods ──────────────────────────────────────────────────────────

sessionSchema.methods.hasActiveParticipant = function (userId) {
  return this.participants.some(
    (p) => p.userId.toString() === userId.toString() && p.isActive
  );
};

sessionSchema.methods.isFull = function () {
  return this.participants.filter((p) => p.isActive).length >= this.maxParticipants;
};

// ── Indexes ───────────────────────────────────────────────────────────────────
sessionSchema.index({ hostId: 1, status: 1 });
sessionSchema.index({ "participants.userId": 1 });
sessionSchema.index({ startedAt: -1 });
sessionSchema.index({ "peerRatings.raterId": 1, "peerRatings.rateeId": 1 });

export const Session = mongoose.model("Session", sessionSchema);
