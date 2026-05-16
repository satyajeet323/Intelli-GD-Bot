/**
 * admin/admins.js — Admin user management (super admin only).
 */

import { Router } from "express";
import { body }   from "express-validator";
import { AdminUser } from "../../models/AdminUser.js";
import { AdminRole }  from "../../models/AdminRole.js";
import { requireSuperAdmin, requireAdmin, signAdminToken, audit } from "../../middleware/adminAuth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();

// GET /api/admin/admins
router.get("/", requireSuperAdmin, async (req, res) => {
  try {
    const admins = await AdminUser.find().populate("role", "name color permissions").lean();
    const safe = admins.map(({ password: _, ...a }) => a);
    res.json({ success: true, admins: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch admins." });
  }
});

// POST /api/admin/admins — create new admin
router.post(
  "/",
  requireSuperAdmin,
  [
    body("name").trim().notEmpty().isLength({ max: 100 }),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
    body("roleId").notEmpty(),
    body("isSuperAdmin").optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, email, password, roleId, isSuperAdmin } = req.body;

      const role = await AdminRole.findById(roleId);
      if (!role) return res.status(400).json({ success: false, message: "Role not found." });

      const existing = await AdminUser.findOne({ email });
      if (existing) return res.status(409).json({ success: false, message: "Email already registered." });

      const admin = await AdminUser.create({ name, email, password, role: roleId, isSuperAdmin: isSuperAdmin ?? false });

      await audit(req, `Created admin: ${email}`, "auth", {
        targetType: "AdminUser", targetId: admin._id.toString(), targetName: email,
        severity: "warning",
      });

      const { password: _, ...safe } = admin.toObject();
      res.status(201).json({ success: true, admin: safe });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: "Email already exists." });
      res.status(500).json({ success: false, message: "Failed to create admin." });
    }
  }
);

// PATCH /api/admin/admins/:id
router.patch("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { name, roleId, isActive, isSuperAdmin } = req.body;
    const patch = {};
    if (name         !== undefined) patch.name         = name;
    if (roleId       !== undefined) patch.role         = roleId;
    if (isActive     !== undefined) patch.isActive     = isActive;
    if (isSuperAdmin !== undefined) patch.isSuperAdmin = isSuperAdmin;

    const admin = await AdminUser.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true })
      .populate("role", "name color")
      .lean();
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found." });

    await audit(req, `Updated admin: ${admin.email}`, "auth", {
      targetType: "AdminUser", targetId: admin._id.toString(), targetName: admin.email,
      details: patch, severity: "warning",
    });

    const { password: _, ...safe } = admin;
    res.json({ success: true, admin: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update admin." });
  }
});

// DELETE /api/admin/admins/:id
router.delete("/:id", requireSuperAdmin, async (req, res) => {
  try {
    if (req.params.id === req.admin._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot delete yourself." });
    }
    const admin = await AdminUser.findByIdAndDelete(req.params.id).lean();
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found." });

    await audit(req, `Deleted admin: ${admin.email}`, "auth", {
      targetType: "AdminUser", targetId: admin._id.toString(), targetName: admin.email,
      severity: "critical",
    });

    res.json({ success: true, message: "Admin deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete admin." });
  }
});

export default router;
