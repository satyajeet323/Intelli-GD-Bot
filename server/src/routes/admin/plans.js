/**
 * admin/plans.js — Subscription plan management.
 */

import { Router } from "express";
import { body }   from "express-validator";
import { Plan }   from "../../models/Plan.js";
import { User }   from "../../models/User.js";
import { requirePermission, audit } from "../../middleware/adminAuth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();

// GET /api/admin/plans
router.get("/", requirePermission("plans.view"), async (req, res) => {
  try {
    const plans = await Plan.find().sort({ sortOrder: 1, name: 1 }).lean();
    // Attach live user counts
    const counts = await User.aggregate([
      { $group: { _id: "$plan", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    const enriched = plans.map((p) => ({ ...p, userCount: countMap[p.slug] ?? 0 }));
    res.json({ success: true, plans: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch plans." });
  }
});

// POST /api/admin/plans
router.post(
  "/",
  requirePermission("plans.create"),
  [
    body("name").trim().notEmpty().isLength({ max: 80 }),
    body("slug").trim().notEmpty().isLength({ max: 40 }).matches(/^[a-z0-9-]+$/),
    body("price.monthly").optional().isNumeric(),
    body("price.yearly").optional().isNumeric(),
    body("features").optional().isArray(),
  ],
  validate,
  async (req, res) => {
    try {
      const plan = await Plan.create({ ...req.body, createdBy: req.admin._id });
      await audit(req, `Created plan: ${plan.name}`, "plans", {
        targetType: "Plan", targetId: plan._id.toString(), targetName: plan.name,
      });
      res.status(201).json({ success: true, plan });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: "Plan name/slug already exists." });
      res.status(500).json({ success: false, message: "Failed to create plan." });
    }
  }
);

// PATCH /api/admin/plans/:id
router.patch("/:id", requirePermission("plans.edit"), async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });

    await audit(req, `Updated plan: ${plan.name}`, "plans", {
      targetType: "Plan", targetId: plan._id.toString(), targetName: plan.name,
      details: req.body,
    });

    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update plan." });
  }
});

// DELETE /api/admin/plans/:id
router.delete("/:id", requirePermission("plans.delete"), async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });
    if (plan.isDefault) return res.status(400).json({ success: false, message: "Cannot delete the default plan." });

    const inUse = await User.countDocuments({ plan: plan.slug });
    if (inUse > 0) return res.status(400).json({ success: false, message: `${inUse} users are on this plan.` });

    await plan.deleteOne();

    await audit(req, `Deleted plan: ${plan.name}`, "plans", {
      targetType: "Plan", targetId: plan._id.toString(), targetName: plan.name,
      severity: "warning",
    });

    res.json({ success: true, message: "Plan deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete plan." });
  }
});

export default router;
