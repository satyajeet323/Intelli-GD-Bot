/**
 * admin/roles.js — Role management routes.
 */

import { Router } from "express";
import { body }   from "express-validator";
import { AdminRole }  from "../../models/AdminRole.js";
import { AdminUser }  from "../../models/AdminUser.js";
import { PERMISSIONS } from "../../models/permissions.js";
import { requirePermission, requireSuperAdmin, audit } from "../../middleware/adminAuth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();

// GET /api/admin/roles
router.get("/", requirePermission("roles.view"), async (req, res) => {
  try {
    const roles = await AdminRole.find().sort({ isSystem: -1, name: 1 }).lean();
    // Attach user counts
    const counts = await AdminUser.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id?.toString(), c.count]));
    const enriched = roles.map((r) => ({ ...r, userCount: countMap[r._id.toString()] ?? 0 }));
    res.json({ success: true, roles: enriched, allPermissions: PERMISSIONS });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch roles." });
  }
});

// POST /api/admin/roles
router.post(
  "/",
  requirePermission("roles.create"),
  [
    body("name").trim().notEmpty().isLength({ max: 80 }),
    body("permissions").isArray(),
    body("description").optional().isString().isLength({ max: 500 }),
    body("color").optional().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, permissions, description, color } = req.body;
      const validPerms = permissions.filter((p) => PERMISSIONS.includes(p));
      const role = await AdminRole.create({
        name, permissions: validPerms, description, color,
        createdBy: req.admin._id,
      });

      await audit(req, `Created role: ${name}`, "roles", {
        targetType: "AdminRole", targetId: role._id.toString(), targetName: name,
      });

      res.status(201).json({ success: true, role });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: "Role name already exists." });
      res.status(500).json({ success: false, message: "Failed to create role." });
    }
  }
);

// PATCH /api/admin/roles/:id
router.patch(
  "/:id",
  requirePermission("roles.edit"),
  [
    body("name").optional().trim().notEmpty().isLength({ max: 80 }),
    body("permissions").optional().isArray(),
    body("description").optional().isString(),
    body("color").optional().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      const role = await AdminRole.findById(req.params.id);
      if (!role) return res.status(404).json({ success: false, message: "Role not found." });

      const { name, permissions, description, color } = req.body;
      if (name)        role.name        = name;
      if (description !== undefined) role.description = description;
      if (color)       role.color       = color;
      if (permissions) role.permissions = permissions.filter((p) => PERMISSIONS.includes(p));

      await role.save();

      await audit(req, `Updated role: ${role.name}`, "roles", {
        targetType: "AdminRole", targetId: role._id.toString(), targetName: role.name,
      });

      res.json({ success: true, role });
    } catch (err) {
      res.status(500).json({ success: false, message: "Failed to update role." });
    }
  }
);

// DELETE /api/admin/roles/:id
router.delete("/:id", requirePermission("roles.delete"), async (req, res) => {
  try {
    const role = await AdminRole.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: "Role not found." });
    if (role.isSystem) return res.status(400).json({ success: false, message: "Cannot delete system roles." });

    const inUse = await AdminUser.countDocuments({ role: role._id });
    if (inUse > 0) return res.status(400).json({ success: false, message: `Role is assigned to ${inUse} admin(s).` });

    await role.deleteOne();

    await audit(req, `Deleted role: ${role.name}`, "roles", {
      targetType: "AdminRole", targetId: role._id.toString(), targetName: role.name,
      severity: "warning",
    });

    res.json({ success: true, message: "Role deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete role." });
  }
});

export default router;
