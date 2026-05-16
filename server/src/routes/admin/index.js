/**
 * admin/index.js — Mounts all admin sub-routers under /api/admin
 */

import { Router } from "express";
import adminAuthRoutes    from "./auth.js";
import adminUserRoutes    from "./users.js";
import adminRoleRoutes    from "./roles.js";
import adminSessionRoutes from "./sessions.js";
import adminPlanRoutes    from "./plans.js";
import adminNotifRoutes   from "./notifications.js";
import adminAnalyticsRoutes from "./analytics.js";
import adminAuditRoutes   from "./audit.js";
import adminSystemRoutes  from "./system.js";
import adminAdminsRoutes  from "./admins.js";

const router = Router();

router.use("/auth",          adminAuthRoutes);
router.use("/users",         adminUserRoutes);
router.use("/roles",         adminRoleRoutes);
router.use("/sessions",      adminSessionRoutes);
router.use("/plans",         adminPlanRoutes);
router.use("/notifications", adminNotifRoutes);
router.use("/analytics",     adminAnalyticsRoutes);
router.use("/audit",         adminAuditRoutes);
router.use("/system",        adminSystemRoutes);
router.use("/admins",        adminAdminsRoutes);

export default router;
