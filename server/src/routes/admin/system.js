/**
 * admin/system.js — System config, feature flags, rate limits, health.
 */

import { Router } from "express";
import { SystemConfig } from "../../models/SystemConfig.js";
import { requirePermission, requireSuperAdmin, audit } from "../../middleware/adminAuth.js";
import { getAllSessions } from "../../sessionStore.js";

const router = Router();

// GET /api/admin/system/health
router.get("/health", requirePermission("system.view"), (req, res) => {
  const io = req.app.get("io");
  res.json({
    success: true,
    health: {
      status:    "ok",
      uptime:    Math.round(process.uptime()),
      memory:    process.memoryUsage(),
      nodeVersion: process.version,
      platform:  process.platform,
      wsClients: io?.engine?.clientsCount ?? 0,
      liveSessions: getAllSessions().length,
      env:       process.env.NODE_ENV ?? "development",
      ts:        new Date().toISOString(),
    },
  });
});

// GET /api/admin/system/config
router.get("/config", requirePermission("system.config"), async (req, res) => {
  try {
    const configs = await SystemConfig.find().sort({ category: 1, key: 1 }).lean();
    // Mask secrets
    const safe = configs.map((c) => ({
      ...c,
      value: c.isSecret ? "***" : c.value,
    }));
    res.json({ success: true, configs: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch config." });
  }
});

// PUT /api/admin/system/config/:key
router.put("/config/:key", requireSuperAdmin, async (req, res) => {
  try {
    const { value, description, type, category, isSecret } = req.body;
    const config = await SystemConfig.findOneAndUpdate(
      { key: req.params.key },
      { $set: { value, description, type, category, isSecret, updatedBy: req.admin._id } },
      { upsert: true, new: true }
    );

    await audit(req, `Updated config: ${req.params.key}`, "config", {
      targetType: "SystemConfig", targetId: req.params.key, targetName: req.params.key,
      details: { key: req.params.key, isSecret },
      severity: "warning",
    });

    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update config." });
  }
});

// GET /api/admin/system/feature-flags
router.get("/feature-flags", requirePermission("featureFlags.view"), async (req, res) => {
  try {
    const flags = await SystemConfig.find({ category: "feature" }).lean();
    res.json({ success: true, flags });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch feature flags." });
  }
});

// PATCH /api/admin/system/feature-flags/:key
router.patch("/feature-flags/:key", requirePermission("featureFlags.manage"), async (req, res) => {
  try {
    const { enabled } = req.body;
    const flag = await SystemConfig.findOneAndUpdate(
      { key: req.params.key, category: "feature" },
      { $set: { value: enabled, updatedBy: req.admin._id } },
      { upsert: true, new: true }
    );

    await audit(req, `${enabled ? "Enabled" : "Disabled"} feature flag: ${req.params.key}`, "config", {
      targetType: "FeatureFlag", targetId: req.params.key, targetName: req.params.key,
      details: { enabled },
    });

    res.json({ success: true, flag });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update feature flag." });
  }
});

// GET /api/admin/system/db-stats
router.get("/db-stats", requirePermission("system.view"), async (req, res) => {
  try {
    const { mongoose } = await import("../../db.js");
    const db = mongoose.connection.db;
    if (!db) return res.json({ success: true, stats: null });

    const stats = await db.stats();
    const collections = await db.listCollections().toArray();

    res.json({
      success: true,
      stats: {
        dbName:      stats.db,
        collections: stats.collections,
        objects:     stats.objects,
        dataSize:    stats.dataSize,
        storageSize: stats.storageSize,
        indexes:     stats.indexes,
        indexSize:   stats.indexSize,
        collectionList: collections.map((c) => c.name),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch DB stats." });
  }
});

export default router;
