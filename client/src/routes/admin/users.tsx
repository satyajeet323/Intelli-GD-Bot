import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminUsers, type PlatformUser, type Pagination } from "@/lib/adminApi";
import { toast } from "sonner";
import {
  Search, Filter, MoreVertical, UserX, UserCheck, KeyRound,
  Trash2, Eye, ChevronLeft, ChevronRight, Download, RefreshCw,
  Users, UserPlus, TrendingUp, Ban,
} from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [users, setUsers]         = useState<PlatformUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [plan, setPlan]           = useState("");
  const [status, setStatus]       = useState("");
  const [page, setPage]           = useState(1);
  const [stats, setStats]         = useState<Record<string, number>>({});
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [suspendModal, setSuspendModal] = useState<PlatformUser | null>(null);
  const [resetModal, setResetModal]     = useState<PlatformUser | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [newPassword, setNewPassword]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (plan)   params.plan   = plan;
      if (status) params.status = status;
      const res = await adminUsers.list(params);
      setUsers(res.users);
      setPagination(res.pagination);
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  }, [page, search, plan, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminUsers.stats().then((r) => setStats(r.stats as Record<string, number>)).catch(() => {});
  }, []);

  async function handleSuspend() {
    if (!suspendModal) return;
    try {
      await adminUsers.suspend(suspendModal._id, suspendReason);
      toast.success("User suspended");
      setSuspendModal(null);
      setSuspendReason("");
      load();
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  async function handleActivate(user: PlatformUser) {
    try {
      await adminUsers.activate(user._id);
      toast.success("User activated");
      load();
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  async function handleResetPassword() {
    if (!resetModal || newPassword.length < 8) return;
    try {
      await adminUsers.resetPassword(resetModal._id, newPassword);
      toast.success("Password reset");
      setResetModal(null);
      setNewPassword("");
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  async function handleDelete(user: PlatformUser) {
    if (!confirm(`Delete ${user.name}? This cannot be undone.`)) return;
    try {
      await adminUsers.delete(user._id);
      toast.success("User deleted");
      load();
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  const planBadge = (p: string) => {
    const map: Record<string, string> = {
      free: "bg-muted text-muted-foreground",
      pro:  "bg-violet-500/10 text-violet-400 border border-violet-500/20",
      enterprise: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    };
    return map[p] ?? "bg-muted text-muted-foreground";
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">User Management</h1>
            <p className="text-sm text-muted-foreground mt-1">{pagination.total} total users</p>
          </div>
          <button onClick={load} className="h-9 w-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total",     value: stats.total     ?? 0, icon: Users,     color: "text-blue-400" },
            { label: "Free",      value: stats.free      ?? 0, icon: UserPlus,  color: "text-muted-foreground" },
            { label: "Pro",       value: stats.pro       ?? 0, icon: TrendingUp, color: "text-violet-400" },
            { label: "Suspended", value: stats.suspended ?? 0, icon: Ban,       color: "text-red-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg bg-muted flex items-center justify-center ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name or email…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border/60 bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={plan}
            onChange={(e) => { setPlan(e.target.value); setPage(1); }}
            className="rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sessions</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 rounded bg-muted animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : users.map((user) => (
                  <tr key={user._id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${planBadge(user.plan)}`}>
                        {user.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{user.sessionCount}</td>
                    <td className="px-4 py-3">
                      {user.isSuspended ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success border border-success/20 px-2 py-0.5 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenu(activeMenu === user._id ? null : user._id)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {activeMenu === user._id && (
                          <div className="absolute right-0 top-9 z-50 w-44 rounded-xl border border-border/60 bg-popover shadow-elegant py-1">
                            {user.isSuspended ? (
                              <button
                                onClick={() => { handleActivate(user); setActiveMenu(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-success"
                              >
                                <UserCheck className="h-4 w-4" /> Activate
                              </button>
                            ) : (
                              <button
                                onClick={() => { setSuspendModal(user); setActiveMenu(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-warning"
                              >
                                <UserX className="h-4 w-4" /> Suspend
                              </button>
                            )}
                            <button
                              onClick={() => { setResetModal(user); setActiveMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors"
                            >
                              <KeyRound className="h-4 w-4" /> Reset Password
                            </button>
                            <div className="my-1 h-px bg-border/50" />
                            <button
                              onClick={() => { handleDelete(user); setActiveMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-destructive"
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground">
                {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-mono">{page} / {pagination.pages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Suspend modal */}
      {suspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 space-y-4 animate-scale-in">
            <h3 className="font-semibold">Suspend {suspendModal.name}?</h3>
            <p className="text-sm text-muted-foreground">The user will be unable to log in until reactivated.</p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-3">
              <button onClick={() => setSuspendModal(null)} className="flex-1 rounded-lg border border-border/60 py-2 text-sm hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleSuspend} className="flex-1 rounded-lg bg-destructive text-destructive-foreground py-2 text-sm font-semibold hover:opacity-80 transition-colors">Suspend</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 space-y-4 animate-scale-in">
            <h3 className="font-semibold">Reset password for {resetModal.name}</h3>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-3">
              <button onClick={() => setResetModal(null)} className="flex-1 rounded-lg border border-border/60 py-2 text-sm hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleResetPassword} disabled={newPassword.length < 8} className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold hover:opacity-80 transition-colors disabled:opacity-50">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Close menu on outside click */}
      {activeMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
      )}
    </AdminLayout>
  );
}
