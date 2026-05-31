/**
 * admin/apiKeys.js — API Key Management routes (Super Admin only).
 *
 * Route order matters — specific paths must come before wildcard /:param routes.
 *
 * POST   /api/admin/api-keys                         — add a new key
 * GET    /api/admin/api-keys                         — list all providers + summary
 * GET    /api/admin/api-keys/internal/active-key/:p  — internal: get active key (service-to-service)
 * GET    /api/admin/api-keys/provider/:provider       — list keys for a provider
 * GET    /api/admin/api-keys/:id/reveal               — reveal decrypted key value
 * POST   /api/admin/api-keys/:id/rotate               — rotate key value
 * POST   /api/admin/api-keys/:id/activate             — set status → active
 * POST   /api/admin/api-keys/:id/deactivate           — set status → deactivated
 * POST   /api/admin/api-keys/:id/reset-usage          — reset usage counters
 * PATCH  /api/admin/api-keys/:id                      — update metadata
 * DELETE /api/admin/api-keys/:id                      — delete key
 */

import { Router } from "express";
import { body, param } from "express-validator";
import { ApiKey, encryptValue } from "../../models/ApiKey.js";
import { apiKeyService } from "../../services/apiKeyService.js";
import { requireSuperAdmin, requirePermission, audit } from "../../middleware/adminAuth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();

// ── POST / — add a new key ────────────────────────────────────────────────────
router.post(
  "/",
  requireSuperAdmin,
  [
    body("provider").trim().notEmpty().isLength({ max: 60 }),
    body("label").trim().notEmpty().isLength({ max: 120 }),
    body("keyValue").trim().notEmpty(),
    body("description").optional().isString().isLength({ max: 500 }),
    body("priority").optional().isInt({ min: 0, max: 100 }),
    body("dailyLimit").optional().isInt({ min: 0 }),
    body("monthlyLimit").optional().isInt({ min: 0 }),
    body("maxConsecutiveFailures").optional().isInt({ min: 1, max: 50 }),
    body("expiresAt").optional().isISO8601(),
    body("tags").optional().isArray(),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        provider, label, keyValue, description = "",
        priority = 0, dailyLimit = 0, monthlyLimit = 0,
        maxConsecutiveFailures = 5, expiresAt, tags = [],
      } = req.body;

      const encryptedKey = encryptValue(keyValue);

      const key = await ApiKey.create({
        provider:    provider.toLowerCase().trim(),
        label,
        description,
        encryptedKey,
        priority,
        dailyLimit,
        monthlyLimit,
        maxConsecutiveFailures,
        expiresAt:   expiresAt ? new Date(expiresAt) : null,
        tags,
        status:      "active",
        usageResetAt: getNextMidnight(),
        createdBy:   req.admin._id,
        updatedBy:   req.admin._id,
      });

      apiKeyService.invalidateCache(provider.toLowerCase().trim());

      await audit(req, `Added API key: ${label} (${provider})`, "apiKeys", {
        targetType: "ApiKey", targetId: key._id.toString(), targetName: label,
        details: { provider, label, priority },
        severity: "warning",
      });

      res.status(201).json({
        success: true,
        key: { ...key.toObject(), encryptedKey: undefined, maskedKey: key.getMaskedKey() },
      });
    } catch (err) {
      console.error("[apiKeys] create:", err.message);
      res.status(500).json({ success: false, message: "Failed to create API key." });
    }
  }
);

// ── GET / — provider summary ──────────────────────────────────────────────────
router.get("/", requirePermission("apiKeys.view"), async (req, res) => {
  try {
    const summary = await apiKeyService.getProviderSummary();
    res.json({ success: true, providers: summary });
  } catch (err) {
    console.error("[apiKeys] list providers:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch API key summary." });
  }
});

// ── GET /internal/active-key/:provider — service-to-service ──────────────────
// Must be declared before /:provider to avoid being swallowed by the wildcard.
router.get("/internal/active-key/:provider", async (req, res) => {
  const secret   = req.headers["x-internal-secret"];
  const expected = process.env.INTERNAL_SERVICE_SECRET ?? process.env.JWT_SECRET;
  if (!secret || secret !== expected) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }
  try {
    const keyInfo = await apiKeyService.getKey(req.params.provider);
    if (!keyInfo) return res.status(404).json({ success: false, message: "No active key." });
    res.json({ success: true, value: keyInfo.value, source: keyInfo.source });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to retrieve key." });
  }
});

// ── GET /provider/:provider — list keys for a provider ───────────────────────
// Uses a /provider/ prefix so it doesn't conflict with /:id sub-routes.
router.get("/provider/:provider", requirePermission("apiKeys.view"), async (req, res) => {
  try {
    const keys = await apiKeyService.listKeysForProvider(req.params.provider);
    res.json({ success: true, keys });
  } catch (err) {
    console.error("[apiKeys] list keys:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch keys." });
  }
});

// ── GET /:id/reveal — reveal decrypted key ────────────────────────────────────
router.get("/:id/reveal", requireSuperAdmin, async (req, res) => {
  try {
    const key = await ApiKey.findById(req.params.id);
    if (!key) return res.status(404).json({ success: false, message: "Key not found." });

    const plain = key.getDecryptedKey();
    if (!plain) return res.status(500).json({ success: false, message: "Decryption failed." });

    await audit(req, `Revealed API key: ${key.label}`, "apiKeys", {
      targetType: "ApiKey", targetId: key._id.toString(), targetName: key.label,
      severity: "critical",
    });

    res.json({ success: true, value: plain });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reveal key." });
  }
});

// ── POST /:id/rotate ──────────────────────────────────────────────────────────
router.post(
  "/:id/rotate",
  requireSuperAdmin,
  [
    param("id").isMongoId(),
    body("newKeyValue").trim().notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const key = await apiKeyService.rotateKey(req.params.id, req.body.newKeyValue, req.admin._id);

      await audit(req, `Rotated API key: ${key.label}`, "apiKeys", {
        targetType: "ApiKey", targetId: key._id.toString(), targetName: key.label,
        details: { provider: key.provider },
        severity: "warning",
      });

      res.json({
        success: true,
        key: { ...key.toObject(), encryptedKey: undefined, maskedKey: key.getMaskedKey() },
      });
    } catch (err) {
      console.error("[apiKeys] rotate:", err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── POST /:id/activate ────────────────────────────────────────────────────────
router.post("/:id/activate", requireSuperAdmin, async (req, res) => {
  try {
    const key = await ApiKey.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "active", consecutiveFailures: 0, updatedBy: req.admin._id } },
      { new: true }
    );
    if (!key) return res.status(404).json({ success: false, message: "Key not found." });
    apiKeyService.invalidateCache(key.provider);

    await audit(req, `Activated API key: ${key.label}`, "apiKeys", {
      targetType: "ApiKey", targetId: key._id.toString(), targetName: key.label,
      severity: "info",
    });

    res.json({ success: true, key: { ...key.toObject(), encryptedKey: undefined, maskedKey: key.getMaskedKey() } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to activate key." });
  }
});

// ── POST /:id/deactivate ──────────────────────────────────────────────────────
router.post("/:id/deactivate", requireSuperAdmin, async (req, res) => {
  try {
    const key = await ApiKey.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "deactivated", updatedBy: req.admin._id } },
      { new: true }
    );
    if (!key) return res.status(404).json({ success: false, message: "Key not found." });
    apiKeyService.invalidateCache(key.provider);

    await audit(req, `Deactivated API key: ${key.label}`, "apiKeys", {
      targetType: "ApiKey", targetId: key._id.toString(), targetName: key.label,
      severity: "warning",
    });

    res.json({ success: true, key: { ...key.toObject(), encryptedKey: undefined, maskedKey: key.getMaskedKey() } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to deactivate key." });
  }
});

// ── POST /:id/reset-usage ─────────────────────────────────────────────────────
router.post("/:id/reset-usage", requireSuperAdmin, async (req, res) => {
  try {
    const key = await ApiKey.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          dailyUsage: 0, monthlyUsage: 0,
          consecutiveFailures: 0,
          status: "active",
          lastError: "",
          updatedBy: req.admin._id,
          usageResetAt: getNextMidnight(),
        },
      },
      { new: true }
    );
    if (!key) return res.status(404).json({ success: false, message: "Key not found." });
    apiKeyService.invalidateCache(key.provider);

    await audit(req, `Reset usage for API key: ${key.label}`, "apiKeys", {
      targetType: "ApiKey", targetId: key._id.toString(), targetName: key.label,
      severity: "info",
    });

    res.json({ success: true, key: { ...key.toObject(), encryptedKey: undefined, maskedKey: key.getMaskedKey() } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reset usage." });
  }
});

// ── PATCH /:id — update metadata ──────────────────────────────────────────────
router.patch(
  "/:id",
  requireSuperAdmin,
  [
    param("id").isMongoId(),
    body("label").optional().trim().notEmpty().isLength({ max: 120 }),
    body("description").optional().isString().isLength({ max: 500 }),
    body("priority").optional().isInt({ min: 0, max: 100 }),
    body("dailyLimit").optional().isInt({ min: 0 }),
    body("monthlyLimit").optional().isInt({ min: 0 }),
    body("maxConsecutiveFailures").optional().isInt({ min: 1, max: 50 }),
    body("expiresAt").optional({ nullable: true }).isISO8601(),
    body("tags").optional().isArray(),
    body("status").optional().isIn(["active", "standby", "deactivated"]),
  ],
  validate,
  async (req, res) => {
    try {
      const allowed = ["label", "description", "priority", "dailyLimit", "monthlyLimit",
                       "maxConsecutiveFailures", "expiresAt", "tags", "status"];
      const updates = {};
      for (const field of allowed) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
      if (updates.expiresAt) updates.expiresAt = new Date(updates.expiresAt);
      updates.updatedBy = req.admin._id;

      const key = await ApiKey.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
      if (!key) return res.status(404).json({ success: false, message: "Key not found." });

      apiKeyService.invalidateCache(key.provider);

      await audit(req, `Updated API key: ${key.label}`, "apiKeys", {
        targetType: "ApiKey", targetId: key._id.toString(), targetName: key.label,
        details: updates,
        severity: "info",
      });

      res.json({
        success: true,
        key: { ...key.toObject(), encryptedKey: undefined, maskedKey: key.getMaskedKey() },
      });
    } catch (err) {
      console.error("[apiKeys] update:", err.message);
      res.status(500).json({ success: false, message: "Failed to update API key." });
    }
  }
);

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const key = await ApiKey.findByIdAndDelete(req.params.id);
    if (!key) return res.status(404).json({ success: false, message: "Key not found." });
    apiKeyService.invalidateCache(key.provider);

    await audit(req, `Deleted API key: ${key.label}`, "apiKeys", {
      targetType: "ApiKey", targetId: req.params.id, targetName: key.label,
      details: { provider: key.provider },
      severity: "critical",
    });

    res.json({ success: true, message: "API key deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete key." });
  }
});

function getNextMidnight() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

export default router;
