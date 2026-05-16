/**
 * admin/audit.js — Audit log viewer.
 */

import { Router } from "express";
import { AuditLog } from "../../models/AuditLog.js";
import { requirePermission } from "../../middleware/adminAuth.js";

const router = Router();

// GET /api/admin/audit
router.get("/", requirePermission("audit.view"), async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page     ?? "1"));
    const limit    = Math.min(200, parseInt(req.query.limit   ?? "50"));
    const category = req.query.category ?? "";
    const severity = req.query.severity ?? "";
    const adminId  = req.query.adminId  ?? "";
    const from     = req.query.from     ?? "";
    const to       = req.query.to       ?? "";
    const search   = req.query.search?.trim() ?? "";

    const filter = {};
    if (category) filter.category = category;
    if (severity) filter.severity = severity;
    if (adminId)  filter.adminId  = adminId;
    if (search)   filter.action   = { $regex: search, $options: "i" };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch audit logs." });
  }
});

export default router;
