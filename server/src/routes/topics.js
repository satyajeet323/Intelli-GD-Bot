/**
 * routes/topics.js — Topic generation REST API
 *
 * GET  /api/topics/generate           — Generate one topic via Gemini
 * GET  /api/topics/generate?category= — Generate from a specific category
 * GET  /api/topics/categories         — List all available categories
 * GET  /api/topics/category/:name     — Not supported (no local pool)
 */

import { Router } from "express";
import { generateTopic, getCategories } from "../topics.js";

const router = Router();

// ── GET /api/topics/generate ──────────────────────────────────────────────────
router.get("/generate", async (req, res) => {
  try {
    const { category } = req.query;
    const result = await generateTopic({ category: category || undefined });
    res.json({
      success:  true,
      topic:    result.topic,
      source:   result.source,
      category: result.category,
    });
  } catch (err) {
    console.error("[topics route] generateTopic failed:", err.message);
    res.status(503).json({
      success: false,
      message: `Topic generation failed: ${err.message}`,
    });
  }
});

// ── GET /api/topics/categories ────────────────────────────────────────────────
router.get("/categories", (_req, res) => {
  res.json({ success: true, categories: getCategories() });
});

// ── GET /api/topics/category/:name — not supported without local pool ─────────
router.get("/category/:name", (_req, res) => {
  res.status(501).json({
    success: false,
    message: "Per-category topic listing is not available. Use GET /api/topics/generate?category=<name> instead.",
  });
});

export default router;
