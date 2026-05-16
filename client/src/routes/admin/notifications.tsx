import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminNotifications, type Notification, type Pagination } from "@/lib/adminApi";
import { toast } from "sonner";
import {
  Plus, Send, Trash2, ChevronLeft, ChevronRight, X,
  Bell, AlertTriangle, Megaphone, Wrench, Tag, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotifications,
});

const TYPE_ICONS: Record<string, typeof Bell> = {
  announcement: Megaphone,
  alert:        AlertTriangle,
  maintenance:  Wrench,
  promotion:    Tag,
  system:       Bell,
};

const PRIORITY_COLORS: Record<string, string> = {
  low:      "bg-muted text-muted-foreground",
  medium:   "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  high:     "bg-warning/10 text-warning border border-warning/20",
  critical: "bg-destructive/10 text-destructive border border-destructive/20",
};

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-400",
  sent:      "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

function NotifModal({ notif, onClose, onSave }: {
  notif: Partial<Notification>;
  onClose: () => void;
  onSave: (data: Partial<Notification>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<Notification> & { isDismissible?: boolean }>({
    title: "", message: "", type: "announcement", priority: "medium",
    targetType: "all", targetPlan: "", isBanner: false, isDismissible: true,
    ...notif,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.title || !form.message) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-6 space-y-4 animate-scale-in">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{notif._id ? "Edit Notification" : "Create Notification"}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Message</label>
          <textarea value={form.message ?? ""} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={4}
            className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <select value={form.type ?? "announcement"} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {["announcement", "alert", "maintenance", "promotion", "system"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <select value={form.priority ?? "medium"} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {["low", "medium", "high", "critical"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Target</label>
            <select value={form.targetType ?? "all"} onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value }))}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">All Users</option>
              <option value="plan">By Plan</option>
            </select>
          </div>
          {form.targetType === "plan" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Plan</label>
              <select value={form.targetPlan ?? ""} onChange={(e) => setForm((f) => ({ ...f, targetPlan: e.target.value }))}
                className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isBanner ?? false} onChange={(e) => setForm((f) => ({ ...f, isBanner: e.target.checked }))} />
            Show as banner
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={(form.isDismissible as boolean) ?? true} onChange={(e) => setForm((f) => ({ ...f, isDismissible: e.target.checked }))} />
            Dismissible
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border/60 py-2 text-sm hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title || !form.message}
            className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold hover:opacity-80 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminNotifications() {
  const [notifs, setNotifs]       = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal]         = useState<Partial<Notification> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await adminNotifications.list(params);
      setNotifs(res.notifications);
      setPagination(res.pagination);
    } catch { toast.error("Failed to load notifications"); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Partial<Notification>) {
    if (data._id) {
      await adminNotifications.update(data._id, data);
      toast.success("Updated");
    } else {
      await adminNotifications.create(data);
      toast.success("Created");
    }
    load();
  }

  async function handleSend(notif: Notification) {
    try {
      const res = await adminNotifications.send(notif._id);
      toast.success(`Sent to ${res.sentCount} users`);
      load();
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this notification?")) return;
    try {
      await adminNotifications.delete(id);
      toast.success("Deleted");
      load();
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and send platform notifications</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="h-9 w-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={() => setModal({})}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-80 transition-colors">
              <Plus className="h-4 w-4" /> New
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {["", "draft", "scheduled", "sent", "cancelled"].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={[
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                statusFilter === s ? "bg-primary text-primary-foreground" : "border border-border/60 hover:bg-muted",
              ].join(" ")}>
              {s || "All"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-card p-4 animate-pulse">
                <div className="h-4 w-48 rounded bg-muted mb-2" />
                <div className="h-3 w-full rounded bg-muted" />
              </div>
            ))
          ) : notifs.length === 0 ? (
            <div className="rounded-2xl border border-border/50 bg-card p-12 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : notifs.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            return (
              <div key={n._id} className="rounded-xl border border-border/50 bg-card p-4 hover:border-foreground/20 transition-all">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{n.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[n.priority]}`}>{n.priority}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[n.status]}`}>{n.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span>Target: {n.targetType === "plan" ? `${n.targetPlan} plan` : n.targetType}</span>
                      {n.sentCount > 0 && <span>Sent to {n.sentCount}</span>}
                      <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {n.status !== "sent" && n.status !== "cancelled" && (
                      <button onClick={() => handleSend(n)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-success/10 hover:text-success transition-colors"
                        title="Send now">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(n._id)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-mono">{page} / {pagination.pages}</span>
            <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
              className="h-8 w-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {modal && <NotifModal notif={modal} onClose={() => setModal(null)} onSave={handleSave} />}
    </AdminLayout>
  );
}
