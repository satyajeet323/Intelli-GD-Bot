/**
 * adminApi.ts — Admin panel API client.
 * Uses a separate token key from the regular user token.
 */

const BASE_URL = (import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000").replace(/\/$/, "");
const ADMIN_TOKEN_KEY = "gdbot_admin_token";

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}
export function setAdminToken(t: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, t);
  // Notify same-tab listeners (storage event only fires in other tabs)
  window.dispatchEvent(new CustomEvent("adminTokenChange", { detail: t }));
}
export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.dispatchEvent(new CustomEvent("adminTokenChange", { detail: null }));
}
export function isAdminAuthenticated(): boolean {
  return !!getAdminToken();
}

export class AdminApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.data = data;
  }
}

type AdminFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  timeout?: number;
};

export async function adminFetch<T = unknown>(
  path: string,
  options: AdminFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, timeout = 15000 } = options;
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  const token = getAdminToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    window.clearTimeout(timer);

    if (res.status === 401) {
      clearAdminToken();
      window.location.href = "/admin/login";
      throw new AdminApiError("Session expired.", 401);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new AdminApiError(
        (data as { message?: string }).message ?? `Request failed (${res.status})`,
        res.status,
        data
      );
    }
    return data as T;
  } catch (err) {
    window.clearTimeout(timer);
    if (err instanceof AdminApiError) throw err;
    if ((err as Error).name === "AbortError") throw new AdminApiError("Request timed out.", 408);
    throw new AdminApiError((err as Error).message ?? "Network error", 0);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminRole = {
  _id: string;
  name: string;
  description: string;
  color: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  createdAt: string;
};

export type AdminUser = {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  role: AdminRole;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLogin: string | null;
  loginCount: number;
  preferences: { theme: string; timezone: string; notifications: boolean };
  createdAt: string;
};

export type PlatformUser = {
  _id: string;
  name: string;
  email: string;
  plan: string;
  avatar: string;
  isSuspended: boolean;
  suspendedAt?: string;
  suspendReason?: string;
  sessionCount: number;
  createdAt: string;
};

export type Plan = {
  _id: string;
  name: string;
  slug: string;
  description: string;
  price: { monthly: number; yearly: number; currency: string };
  features: string[];
  limits: {
    sessionsPerMonth: number;
    aiSessionsPerDay: number;
    maxParticipants: number;
    historyRetainDays: number;
    apiCallsPerDay: number;
    storageGB: number;
  };
  isActive: boolean;
  isPublic: boolean;
  isDefault: boolean;
  color: string;
  badge: string;
  userCount: number;
  sortOrder: number;
};

export type Notification = {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  targetType: string;
  targetPlan: string;
  targetRole: string;
  status: string;
  scheduledAt: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  sentCount: number;
  readCount: number;
  isBanner: boolean;
  isDismissible: boolean;
  actionUrl: string;
  actionLabel: string;
  createdBy: { name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditEntry = {
  _id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: string;
  category: string;
  targetType: string;
  targetId: string;
  targetName: string;
  severity: "info" | "warning" | "critical";
  ip: string;
  createdAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

// ── API modules ───────────────────────────────────────────────────────────────

export const adminAuth = {
  login: (email: string, password: string) =>
    adminFetch<{ success: boolean; token: string; admin: AdminUser }>("/api/admin/auth/login", {
      method: "POST",
      body: { email, password },
    }).then((res) => { setAdminToken(res.token); return res; }),

  me: () => adminFetch<{ success: boolean; admin: AdminUser }>("/api/admin/auth/me"),

  logout: async () => {
    try { await adminFetch("/api/admin/auth/logout", { method: "POST" }); } catch {}
    clearAdminToken();
    window.location.href = "/admin/login";
  },
};

export const adminUsers = {
  list: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return adminFetch<{ success: boolean; users: PlatformUser[]; pagination: Pagination }>(
      `/api/admin/users${qs ? `?${qs}` : ""}`
    );
  },
  stats: () => adminFetch<{ success: boolean; stats: Record<string, unknown> }>("/api/admin/users/stats"),
  get: (id: string) => adminFetch<{ success: boolean; user: PlatformUser; recentSessions: unknown[] }>(`/api/admin/users/${id}`),
  update: (id: string, data: Partial<PlatformUser>) =>
    adminFetch<{ success: boolean; user: PlatformUser }>(`/api/admin/users/${id}`, { method: "PATCH", body: data }),
  suspend: (id: string, reason?: string) =>
    adminFetch<{ success: boolean; user: PlatformUser }>(`/api/admin/users/${id}/suspend`, { method: "POST", body: { reason } }),
  activate: (id: string) =>
    adminFetch<{ success: boolean; user: PlatformUser }>(`/api/admin/users/${id}/activate`, { method: "POST" }),
  resetPassword: (id: string, newPassword: string) =>
    adminFetch<{ success: boolean; message: string }>(`/api/admin/users/${id}/reset-password`, { method: "POST", body: { newPassword } }),
  delete: (id: string) =>
    adminFetch<{ success: boolean; message: string }>(`/api/admin/users/${id}`, { method: "DELETE" }),
};

export const adminRoles = {
  list: () => adminFetch<{ success: boolean; roles: AdminRole[]; allPermissions: string[] }>("/api/admin/roles"),
  create: (data: Partial<AdminRole>) =>
    adminFetch<{ success: boolean; role: AdminRole }>("/api/admin/roles", { method: "POST", body: data }),
  update: (id: string, data: Partial<AdminRole>) =>
    adminFetch<{ success: boolean; role: AdminRole }>(`/api/admin/roles/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) =>
    adminFetch<{ success: boolean; message: string }>(`/api/admin/roles/${id}`, { method: "DELETE" }),
};

export const adminSessions = {
  list: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return adminFetch<{ success: boolean; sessions: unknown[]; pagination: Pagination }>(
      `/api/admin/sessions${qs ? `?${qs}` : ""}`
    );
  },
  live: () => adminFetch<{ success: boolean; sessions: unknown[]; count: number }>("/api/admin/sessions/live"),
  stats: () => adminFetch<{ success: boolean; stats: Record<string, unknown> }>("/api/admin/sessions/stats"),
  get: (id: string) => adminFetch<{ success: boolean; session: unknown }>(`/api/admin/sessions/${id}`),
  delete: (id: string) => adminFetch<{ success: boolean; message: string }>(`/api/admin/sessions/${id}`, { method: "DELETE" }),
};

export const adminPlans = {
  list: () => adminFetch<{ success: boolean; plans: Plan[] }>("/api/admin/plans"),
  create: (data: Partial<Plan>) => adminFetch<{ success: boolean; plan: Plan }>("/api/admin/plans", { method: "POST", body: data }),
  update: (id: string, data: Partial<Plan>) =>
    adminFetch<{ success: boolean; plan: Plan }>(`/api/admin/plans/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => adminFetch<{ success: boolean; message: string }>(`/api/admin/plans/${id}`, { method: "DELETE" }),
};

export const adminNotifications = {
  list: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return adminFetch<{ success: boolean; notifications: Notification[]; pagination: Pagination }>(
      `/api/admin/notifications${qs ? `?${qs}` : ""}`
    );
  },
  stats: () =>
    adminFetch<{ success: boolean; stats: Record<string, unknown> }>("/api/admin/notifications/stats"),
  analytics: (id: string) =>
    adminFetch<{ success: boolean; analytics: { delivered: number; read: number; dismissed: number; readRate: number; dismissRate: number } }>(
      `/api/admin/notifications/${id}/analytics`
    ),
  create: (data: Partial<Notification>) =>
    adminFetch<{ success: boolean; notification: Notification }>("/api/admin/notifications", { method: "POST", body: data }),
  update: (id: string, data: Partial<Notification>) =>
    adminFetch<{ success: boolean; notification: Notification }>(`/api/admin/notifications/${id}`, { method: "PATCH", body: data }),
  send: (id: string) =>
    adminFetch<{ success: boolean; notification: Notification; sentCount: number }>(`/api/admin/notifications/${id}/send`, { method: "POST" }),
  activate: (id: string) =>
    adminFetch<{ success: boolean; notification: Notification }>(`/api/admin/notifications/${id}/activate`, { method: "POST" }),
  deactivate: (id: string) =>
    adminFetch<{ success: boolean; notification: Notification }>(`/api/admin/notifications/${id}/deactivate`, { method: "POST" }),
  delete: (id: string) =>
    adminFetch<{ success: boolean; message: string }>(`/api/admin/notifications/${id}`, { method: "DELETE" }),
};

export const adminAnalytics = {
  overview: () => adminFetch<{ success: boolean; overview: Record<string, unknown> }>("/api/admin/analytics/overview"),
  users: (days = 30) => adminFetch<Record<string, unknown>>(`/api/admin/analytics/users?days=${days}`),
  sessions: (days = 30) => adminFetch<Record<string, unknown>>(`/api/admin/analytics/sessions?days=${days}`),
  performance: () => adminFetch<{ success: boolean; performance: Record<string, unknown> }>("/api/admin/analytics/performance"),
  security: () => adminFetch<{ success: boolean; security: Record<string, unknown> }>("/api/admin/analytics/security"),
};

export const adminAudit = {
  list: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return adminFetch<{ success: boolean; logs: AuditEntry[]; pagination: Pagination }>(
      `/api/admin/audit${qs ? `?${qs}` : ""}`
    );
  },
};

export const adminSystem = {
  health: () => adminFetch<{ success: boolean; health: Record<string, unknown> }>("/api/admin/system/health"),
  config: () => adminFetch<{ success: boolean; configs: unknown[] }>("/api/admin/system/config"),
  updateConfig: (key: string, data: unknown) =>
    adminFetch<{ success: boolean; config: unknown }>(`/api/admin/system/config/${key}`, { method: "PUT", body: data }),
  featureFlags: () => adminFetch<{ success: boolean; flags: unknown[] }>("/api/admin/system/feature-flags"),
  updateFlag: (key: string, enabled: boolean) =>
    adminFetch<{ success: boolean; flag: unknown }>(`/api/admin/system/feature-flags/${key}`, { method: "PATCH", body: { enabled } }),
  dbStats: () => adminFetch<{ success: boolean; stats: Record<string, unknown> }>("/api/admin/system/db-stats"),
};

export const adminAdmins = {
  list: () => adminFetch<{ success: boolean; admins: AdminUser[] }>("/api/admin/admins"),
  create: (data: Partial<AdminUser> & { password: string; roleId: string }) =>
    adminFetch<{ success: boolean; admin: AdminUser }>("/api/admin/admins", { method: "POST", body: data }),
  update: (id: string, data: Partial<AdminUser> & { roleId?: string }) =>
    adminFetch<{ success: boolean; admin: AdminUser }>(`/api/admin/admins/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) =>
    adminFetch<{ success: boolean; message: string }>(`/api/admin/admins/${id}`, { method: "DELETE" }),
};

// ── API Key Management types ───────────────────────────────────────────────────

export type ApiKeyStatus =
  | "active" | "in_use" | "standby" | "rate_limited"
  | "exhausted" | "expired" | "deactivated";

export type ApiKeyEntry = {
  _id: string;
  provider: string;
  label: string;
  description: string;
  maskedKey: string;
  status: ApiKeyStatus;
  priority: number;
  dailyLimit: number;
  monthlyLimit: number;
  dailyUsage: number;
  monthlyUsage: number;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  totalRequests: number;
  totalSuccess: number;
  totalFailures: number;
  successRate: number;
  lastUsedAt: string | null;
  lastErrorAt: string | null;
  lastError: string;
  expiresAt: string | null;
  rotatedAt: string | null;
  tags: string[];
  createdBy: { name: string; email: string } | null;
  updatedBy: { name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
  recentLogs: Array<{
    ts: string;
    success: boolean;
    latency: number;
    error: string;
    endpoint: string;
  }>;
};

export type ApiKeyProviderSummary = {
  _id: string;
  total: number;
  active: number;
  in_use: number;
  standby: number;
  exhausted: number;
  deactivated: number;
  totalRequests: number;
  totalSuccess: number;
  totalFailures: number;
  lastUsedAt: string | null;
};

export const adminApiKeys = {
  providers: () =>
    adminFetch<{ success: boolean; providers: ApiKeyProviderSummary[] }>("/api/admin/api-keys"),

  list: (provider: string) =>
    adminFetch<{ success: boolean; keys: ApiKeyEntry[] }>(`/api/admin/api-keys/provider/${provider}`),

  create: (data: {
    provider: string; label: string; keyValue: string;
    description?: string; priority?: number;
    dailyLimit?: number; monthlyLimit?: number;
    maxConsecutiveFailures?: number; expiresAt?: string; tags?: string[];
  }) => adminFetch<{ success: boolean; key: ApiKeyEntry }>("/api/admin/api-keys", { method: "POST", body: data }),

  update: (id: string, data: Partial<ApiKeyEntry>) =>
    adminFetch<{ success: boolean; key: ApiKeyEntry }>(`/api/admin/api-keys/${id}`, { method: "PATCH", body: data }),

  rotate: (id: string, newKeyValue: string) =>
    adminFetch<{ success: boolean; key: ApiKeyEntry }>(`/api/admin/api-keys/${id}/rotate`, {
      method: "POST", body: { newKeyValue },
    }),

  activate: (id: string) =>
    adminFetch<{ success: boolean; key: ApiKeyEntry }>(`/api/admin/api-keys/${id}/activate`, { method: "POST" }),

  deactivate: (id: string) =>
    adminFetch<{ success: boolean; key: ApiKeyEntry }>(`/api/admin/api-keys/${id}/deactivate`, { method: "POST" }),

  resetUsage: (id: string) =>
    adminFetch<{ success: boolean; key: ApiKeyEntry }>(`/api/admin/api-keys/${id}/reset-usage`, { method: "POST" }),

  reveal: (id: string) =>
    adminFetch<{ success: boolean; value: string }>(`/api/admin/api-keys/${id}/reveal`),

  delete: (id: string) =>
    adminFetch<{ success: boolean; message: string }>(`/api/admin/api-keys/${id}`, { method: "DELETE" }),
};
