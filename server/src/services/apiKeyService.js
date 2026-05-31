/**
 * apiKeyService.js — Dynamic API key selection, rotation, and failover.
 *
 * Usage:
 *   const key = await apiKeyService.getKey("gemini");
 *   // use key.value ...
 *   await apiKeyService.reportSuccess("gemini", key.id, { latency: 120 });
 *   await apiKeyService.reportFailure("gemini", key.id, { error: "quota exceeded" });
 */

import { ApiKey, encryptValue, decryptValue, maskValue } from "../models/ApiKey.js";

// In-memory cache: provider → { keyId, value, cachedAt }
const _cache = new Map();
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Returns the best available key for a provider.
 * Selection order: active keys sorted by priority desc, then least recently used.
 * Falls back to .env if no DB key is available.
 */
export async function getKey(provider) {
  // Check cache
  const cached = _cache.get(provider);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  // Reset daily usage for keys whose reset time has passed
  await resetDailyUsageIfNeeded(provider);

  // Query active/standby keys for this provider
  const keys = await ApiKey.find({
    provider,
    status: { $in: ["active", "standby", "in_use"] },
  })
    .sort({ priority: -1, lastUsedAt: 1 })
    .lean();

  if (!keys.length) {
    // Fallback to environment variable
    const envKey = getEnvFallback(provider);
    if (envKey) {
      return { id: null, value: envKey, source: "env" };
    }
    return null;
  }

  // Prefer "active" over "standby" / "in_use"
  const active  = keys.filter((k) => k.status === "active");
  const chosen  = active.length ? active[0] : keys[0];
  const value   = decryptValue(chosen.encryptedKey);

  if (!value) {
    // Decryption failed — mark as deactivated and retry without this key
    await ApiKey.findByIdAndUpdate(chosen._id, { status: "deactivated" });
    _cache.delete(provider);
    return getKey(provider);
  }

  // Mark as in_use
  await ApiKey.findByIdAndUpdate(chosen._id, { status: "in_use" });

  const result = { id: chosen._id.toString(), value, source: "db", label: chosen.label };
  _cache.set(provider, { ...result, cachedAt: Date.now() });
  return result;
}

/**
 * Report a successful API call.
 */
export async function reportSuccess(provider, keyId, opts = {}) {
  if (!keyId) return;
  _cache.delete(provider);
  const key = await ApiKey.findById(keyId);
  if (!key) return;
  // Restore to active after successful use
  if (key.status === "in_use") key.status = "active";
  await key.recordUsage(true, opts);
}

/**
 * Report a failed API call. Handles auto-rotation.
 */
export async function reportFailure(provider, keyId, opts = {}) {
  if (!keyId) return;
  _cache.delete(provider);
  const key = await ApiKey.findById(keyId);
  if (!key) return;
  await key.recordUsage(false, opts);
}

/**
 * Rotate a key: replace the encrypted value with a new one.
 * Returns the updated key document.
 */
export async function rotateKey(keyId, newPlainValue, adminId) {
  _cache.clear();
  const key = await ApiKey.findById(keyId);
  if (!key) throw new Error("Key not found");
  key.encryptedKey = encryptValue(newPlainValue);
  key.rotatedAt    = new Date();
  key.rotatedBy    = adminId;
  key.status       = "active";
  key.consecutiveFailures = 0;
  key.dailyUsage   = 0;
  key.monthlyUsage = 0;
  await key.save();
  return key;
}

/**
 * Get all keys for a provider with masked values (for admin UI).
 */
export async function listKeysForProvider(provider) {
  const keys = await ApiKey.find({ provider })
    .sort({ priority: -1, createdAt: -1 })
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  return keys.map((k) => ({
    ...k,
    encryptedKey: undefined,
    maskedKey: k.encryptedKey ? maskValue(decryptValue(k.encryptedKey) ?? "") : "••••••••",
    successRate: k.totalRequests ? Math.round((k.totalSuccess / k.totalRequests) * 100) : 100,
  }));
}

/**
 * Get all providers with summary stats.
 */
export async function getProviderSummary() {
  const agg = await ApiKey.aggregate([
    {
      $group: {
        _id: "$provider",
        total:       { $sum: 1 },
        active:      { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
        in_use:      { $sum: { $cond: [{ $eq: ["$status", "in_use"] }, 1, 0] } },
        standby:     { $sum: { $cond: [{ $eq: ["$status", "standby"] }, 1, 0] } },
        exhausted:   { $sum: { $cond: [{ $eq: ["$status", "exhausted"] }, 1, 0] } },
        deactivated: { $sum: { $cond: [{ $eq: ["$status", "deactivated"] }, 1, 0] } },
        totalRequests: { $sum: "$totalRequests" },
        totalSuccess:  { $sum: "$totalSuccess" },
        totalFailures: { $sum: "$totalFailures" },
        lastUsedAt:  { $max: "$lastUsedAt" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return agg;
}

/**
 * Invalidate the in-memory cache for a provider (or all providers).
 */
export function invalidateCache(provider) {
  if (provider) _cache.delete(provider);
  else _cache.clear();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function resetDailyUsageIfNeeded(provider) {
  const now = new Date();
  await ApiKey.updateMany(
    {
      provider,
      usageResetAt: { $lte: now },
      dailyUsage:   { $gt: 0 },
    },
    {
      $set: {
        dailyUsage:   0,
        usageResetAt: getNextMidnight(),
      },
    }
  );
  // Restore keys that were exhausted only due to daily limit
  await ApiKey.updateMany(
    {
      provider,
      status: "exhausted",
      dailyLimit: { $gt: 0 },
      dailyUsage: 0,
    },
    { $set: { status: "active" } }
  );
}

function getNextMidnight() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

function getEnvFallback(provider) {
  const map = {
    gemini:     process.env.GEMINI_API_KEY,
    groq:       process.env.GROQ_API_KEY,
    elevenlabs: process.env.ELEVENLABS_API_KEY,
    openai:     process.env.OPENAI_API_KEY,
  };
  return map[provider.toLowerCase()] ?? null;
}

export const apiKeyService = {
  getKey,
  reportSuccess,
  reportFailure,
  rotateKey,
  listKeysForProvider,
  getProviderSummary,
  invalidateCache,
};
