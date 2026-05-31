/**
 * ApiKey.js — Encrypted API key storage with usage tracking and status management.
 *
 * Keys are encrypted at rest using AES-256-GCM.
 * The encryption key is derived from API_KEY_ENCRYPTION_SECRET in .env.
 */

import { mongoose } from "../db.js";
import crypto from "crypto";

// ── Encryption helpers ────────────────────────────────────────────────────────
const ALGO = "aes-256-gcm";

function getEncKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET ?? process.env.JWT_SECRET ?? "fallback_enc_key_32bytes_padding!";
  // Derive a 32-byte key from the secret
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptValue(plaintext) {
  const iv  = crypto.randomBytes(16);
  const key = getEncKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as: iv(hex):tag(hex):ciphertext(hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptValue(stored) {
  try {
    const [ivHex, tagHex, ctHex] = stored.split(":");
    const iv  = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ct  = Buffer.from(ctHex, "hex");
    const key = getEncKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ct) + decipher.final("utf8");
  } catch {
    return null; // decryption failed
  }
}

export function maskValue(plain) {
  if (!plain || plain.length < 8) return "••••••••";
  return plain.slice(0, 4) + "••••••••" + plain.slice(-4);
}

// ── Schema ────────────────────────────────────────────────────────────────────

const usageLogSchema = new mongoose.Schema({
  ts:      { type: Date, default: Date.now },
  success: { type: Boolean, required: true },
  latency: { type: Number, default: 0 },   // ms
  error:   { type: String, default: "" },
  endpoint:{ type: String, default: "" },
}, { _id: false });

const apiKeySchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    provider:    { type: String, required: true, trim: true, index: true },
    label:       { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 500 },

    // ── Encrypted key value ───────────────────────────────────────────────────
    encryptedKey: { type: String, required: true },  // AES-256-GCM encrypted

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["active", "standby", "in_use", "rate_limited", "exhausted", "expired", "deactivated"],
      default: "active",
      index: true,
    },
    priority: { type: Number, default: 0 },  // higher = preferred; used for ordering

    // ── Quota / limits ────────────────────────────────────────────────────────
    dailyLimit:   { type: Number, default: 0 },   // 0 = unlimited
    monthlyLimit: { type: Number, default: 0 },   // 0 = unlimited
    dailyUsage:   { type: Number, default: 0 },
    monthlyUsage: { type: Number, default: 0 },
    usageResetAt: { type: Date, default: null },   // next daily reset

    // ── Failure tracking ──────────────────────────────────────────────────────
    consecutiveFailures: { type: Number, default: 0 },
    maxConsecutiveFailures: { type: Number, default: 5 },
    totalRequests: { type: Number, default: 0 },
    totalSuccess:  { type: Number, default: 0 },
    totalFailures: { type: Number, default: 0 },

    // ── Timestamps ────────────────────────────────────────────────────────────
    lastUsedAt:   { type: Date, default: null },
    lastErrorAt:  { type: Date, default: null },
    lastError:    { type: String, default: "" },
    expiresAt:    { type: Date, default: null },

    // ── Recent usage log (capped at 100 entries) ──────────────────────────────
    recentLogs: { type: [usageLogSchema], default: [] },

    // ── Metadata ──────────────────────────────────────────────────────────────
    tags:      [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    rotatedAt: { type: Date, default: null },
    rotatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
apiKeySchema.index({ provider: 1, status: 1, priority: -1 });
apiKeySchema.index({ expiresAt: 1 }, { sparse: true });

// ── Virtual: success rate ─────────────────────────────────────────────────────
apiKeySchema.virtual("successRate").get(function () {
  if (!this.totalRequests) return 100;
  return Math.round((this.totalSuccess / this.totalRequests) * 100);
});

// ── Method: record a usage event ─────────────────────────────────────────────
apiKeySchema.methods.recordUsage = async function (success, opts = {}) {
  const { latency = 0, error = "", endpoint = "" } = opts;

  this.totalRequests++;
  this.lastUsedAt = new Date();

  if (success) {
    this.totalSuccess++;
    this.consecutiveFailures = 0;
    this.dailyUsage++;
    this.monthlyUsage++;
  } else {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.lastErrorAt = new Date();
    this.lastError   = error;
  }

  // Cap recent logs at 100
  if (this.recentLogs.length >= 100) this.recentLogs.shift();
  this.recentLogs.push({ ts: new Date(), success, latency, error, endpoint });

  // Auto-exhaust on too many consecutive failures
  if (this.consecutiveFailures >= this.maxConsecutiveFailures && this.status === "active") {
    this.status = "exhausted";
  }

  // Auto-exhaust on daily limit
  if (this.dailyLimit > 0 && this.dailyUsage >= this.dailyLimit) {
    this.status = "exhausted";
  }

  // Auto-expire check
  if (this.expiresAt && new Date() > this.expiresAt) {
    this.status = "expired";
  }

  await this.save();
};

// ── Method: get decrypted key ─────────────────────────────────────────────────
apiKeySchema.methods.getDecryptedKey = function () {
  return decryptValue(this.encryptedKey);
};

// ── Method: get masked key ────────────────────────────────────────────────────
apiKeySchema.methods.getMaskedKey = function () {
  const plain = decryptValue(this.encryptedKey);
  return plain ? maskValue(plain) : "••••••••";
};

export const ApiKey = mongoose.model("ApiKey", apiKeySchema);
