/**
 * seedAdmin.js — Creates default admin roles and a super admin account.
 * Run once: node src/seedAdmin.js
 *
 * Env vars needed:
 *   MONGODB_URI
 *   ADMIN_EMAIL    (default: admin@gdbot.local)
 *   ADMIN_PASSWORD (default: Admin@123456)
 */

import "dotenv/config";
import { connectDB } from "./db.js";
import { AdminRole }  from "./models/AdminRole.js";
import { AdminUser }  from "./models/AdminUser.js";
import { PERMISSIONS } from "./models/permissions.js";

await connectDB();

// ── Default roles ─────────────────────────────────────────────────────────────
const defaultRoles = [
  {
    name: "Super Admin",
    description: "Full access to all platform features",
    color: "#ef4444",
    permissions: [...PERMISSIONS],
    isSystem: true,
  },
  {
    name: "Moderator",
    description: "Manages sessions, reports, and content",
    color: "#f97316",
    permissions: ["users.view", "sessions.view", "sessions.manage", "reports.view", "reports.moderate", "content.view", "content.moderate", "audit.view"],
    isSystem: true,
  },
  {
    name: "Evaluator",
    description: "Reviews session reports and ML performance",
    color: "#8b5cf6",
    permissions: ["sessions.view", "reports.view", "reports.export", "ml.view", "analytics.view"],
    isSystem: true,
  },
  {
    name: "Support Staff",
    description: "Handles user support and account issues",
    color: "#06b6d4",
    permissions: ["users.view", "users.edit", "users.suspend", "sessions.view", "notifications.view", "notifications.create", "audit.view"],
    isSystem: true,
  },
  {
    name: "Content Manager",
    description: "Manages topics and content moderation",
    color: "#10b981",
    permissions: ["content.view", "content.moderate", "topics.view", "topics.manage", "notifications.view", "notifications.create", "notifications.send"],
    isSystem: true,
  },
  {
    name: "Analytics Manager",
    description: "Access to all analytics and reports",
    color: "#f59e0b",
    permissions: ["analytics.view", "analytics.export", "reports.view", "reports.export", "sessions.view", "users.view", "audit.view"],
    isSystem: true,
  },
];

console.log("Seeding admin roles…");
const roleMap = {};
for (const roleDef of defaultRoles) {
  const role = await AdminRole.findOneAndUpdate(
    { name: roleDef.name },
    { $set: roleDef },
    { upsert: true, new: true }
  );
  roleMap[roleDef.name] = role._id;
  console.log(`  ✓ Role: ${roleDef.name}`);
}

// ── Super admin account ───────────────────────────────────────────────────────
const email    = process.env.ADMIN_EMAIL    ?? "admin@gdbot.local";
const password = process.env.ADMIN_PASSWORD ?? "Admin@123456";

const existing = await AdminUser.findOne({ email });
if (existing) {
  console.log(`\nAdmin already exists: ${email}`);
} else {
  await AdminUser.create({
    name:         "Super Admin",
    email,
    password,
    role:         roleMap["Super Admin"],
    isSuperAdmin: true,
    isActive:     true,
  });
  console.log(`\n✓ Super admin created: ${email}`);
  console.log(`  Password: ${password}`);
  console.log("  ⚠  Change this password immediately after first login!\n");
}

process.exit(0);
