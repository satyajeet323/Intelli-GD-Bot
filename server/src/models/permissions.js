/**
 * permissions.js — All admin permission strings.
 * Kept in a separate file to avoid circular imports between AdminUser ↔ AdminRole.
 */

export const PERMISSIONS = [
  "users.view", "users.edit", "users.suspend", "users.delete", "users.resetPassword",
  "roles.view", "roles.create", "roles.edit", "roles.delete",
  "sessions.view", "sessions.manage", "sessions.delete",
  "reports.view", "reports.moderate", "reports.export",
  "plans.view", "plans.create", "plans.edit", "plans.delete",
  "notifications.view", "notifications.create", "notifications.send", "notifications.delete",
  "analytics.view", "analytics.export",
  "system.view", "system.config", "system.backup",
  "audit.view",
  "content.view", "content.moderate",
  "topics.view", "topics.manage",
  "ml.view", "ml.manage",
  "support.view", "support.manage",
  "featureFlags.view", "featureFlags.manage",
  "rateLimit.view", "rateLimit.manage",
];
