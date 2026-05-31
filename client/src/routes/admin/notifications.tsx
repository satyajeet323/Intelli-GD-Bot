import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminNotifications, type Notification, type Pagination } from "@/lib/adminApi";
import { toast } from "sonner";
import {
  Plus, Send, Trash2, ChevronLeft, ChevronRight, X, Bell,
  AlertTriangle, Megaphone, Wrench, Tag, RefreshCw, Shield,
  Zap, Settings, BarChart2, Eye, XCircle,
  Calendar, Clock, Users, Edit2, ToggleLeft, ToggleRight,
} from "lucide-react";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotifications,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, typeof Bell> = {
  announcement: Megaphone, alert: AlertTriangle, maintenance: Wrench,
  promotion: Tag, system: Bell, security: Shield, feature: Zap, custom: Settings,
};

const TYPES = ["announcement", "alert", "maintenance", "promotion", "system", "security", "feature", "custom"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["", "draft", "active", "scheduled", "sent", "cancelled"];

const PRIORITY_COLORS: Record<string, string> = {
  low:      "bg-muted text-muted-foreground",
  medium:   "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  high:     "bg-warning/10 text-warning border border-warning/20",
  critical: "bg-destructive/10 text-destructive border border-destructive/20",
};

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground",
  active:    "bg-success/10 text-success border border-success/20",
  scheduled: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  sent:      "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

// ── Analytics Modal ───────────────────────────────────────────────────────────

function AnalyticsModal({ notif, onClose }: { notif: Notification; onClose: () => void }) {
  const [data, setData] = useState<{ delivered: number; read: number; dismissed: number; readRate: number; dismissRate: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminNotifications.analytics(notif._id)
      .then((r) => setData(r.analytics))
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [notif._id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 space-y-4 animate-scale-in">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><BarChart2 className="h-4 w-4" /> Analytics</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-1">{notif.title}</p>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0,1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Delivered", value: data.delivered, icon: Users, color: "text-blue-400" },
              { label: "Read", value: data.read, icon: Eye, color: "text-success" },
              { label: "Read Rate", value: `${data.readRate}%`, icon: BarChart2, color: "text-warning" },
              { label: "Dismissed", value: data.dismissed, icon: XCircle, color: "text-muted-foreground" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-border/50 bg-muted/30 p-4">
                <Icon className={`h-4 w-4 mb-2 ${color}`} />
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        ) : null}
        <button onClick={onClose} className="w-full rounded-lg border border-border/60 py-2 text-sm hover:bg-muted transition-colors">Close</button>
      </div>
    </div>
  );
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

type FormData = Partial<Notification> & { isDismissible?: boolean };

// Format a UTC ISO date string in the browser's local timezone
function fmtLocal(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...opts,
  }).format(new Date(iso));
}

// Convert a UTC ISO string → "YYYY-MM-DDTHH:mm" in the browser's local timezone
function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// Convert a datetime-local string (local time, no timezone) to UTC ISO
function localToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local); // no tz suffix → parsed as local time per spec
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function NotifModal({ notif, onClose, onSave }: {
  notif: Partial<Notification>;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
}) {
  // Store datetime fields as datetime-local strings (local time) for the input
  const [form, setForm] = useState<FormData & { _scheduledLocal: string; _expiresLocal: string }>({
    title: "", message: "", type: "announcement", priority: "medium",
    targetType: "all", targetPlan: "", targetRole: "",
    isBanner: false, isDismissible: true,
    actionUrl: "", actionLabel: "",
    scheduledAt: null, expiresAt: null,
    _scheduledLocal: isoToLocal(notif.scheduledAt),
    _expiresLocal:   isoToLocal(notif.expiresAt),
    ...notif,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title?.trim() || !form.message?.trim()) return;
    setSaving(true);
    try {
      // Convert local datetime strings → ISO at save time
      const payload: FormData = {
        ...form,
        scheduledAt: localToIso(form._scheduledLocal),
        expiresAt:   localToIso(form._expiresLocal),
      };
      await onSave(payload);
      onClose();
    }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-6 space-y-4 animate-scale-in">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{notif._id ? "Edit Notification" : "Create Notification"}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Title *</label>
          <input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)}
            placeholder="Notification title"
            className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Message *</label>
          <textarea value={form.message ?? ""} onChange={(e) => set("message", e.target.value)} rows={3}
            placeholder="Notification body text"
            className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <select value={form.type ?? "announcement"} onChange={(e) => set("type", e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <select value={form.priority ?? "medium"} onChange={(e) => set("priority", e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Target</label>
            <select value={form.targetType ?? "all"} onChange={(e) => set("targetType", e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">All Users</option>
              <option value="plan">By Plan</option>
              <option value="role">By Role</option>
            </select>
          </div>
          {form.targetType === "plan" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Plan</label>
              <select value={form.targetPlan ?? ""} onChange={(e) => set("targetPlan", e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          )}
          {form.targetType === "role" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <select value={form.targetRole ?? ""} onChange={(e) => set("targetRole", e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Schedule At</label>
            <input type="datetime-local" value={form._scheduledLocal}
              onChange={(e) => set("_scheduledLocal", e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Expires At</label>
            <input type="datetime-local" value={form._expiresLocal}
              onChange={(e) => set("_expiresLocal", e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Action URL</label>
            <input value={form.actionUrl ?? ""} onChange={(e) => set("actionUrl", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Action Label</label>
            <input value={form.actionLabel ?? ""} onChange={(e) => set("actionLabel", e.target.value)}
              placeholder="Learn more"
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="flex items-center gap-5 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isBanner ?? false} onChange={(e) => set("isBanner", e.target.checked)} />
            <span className="text-xs">Show as banner</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={(form.isDismissible as boolean) ?? true} onChange={(e) => set("isDismissible", e.target.checked)} />
            <span className="text-xs">Dismissible</span>
          </label>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border/60 py-2 text-sm hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title?.trim() || !form.message?.trim()}
            className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold hover:opacity-80 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: Record<string, unknown> | null }) {
  if (!stats) return null;
  const cards = [
    { label: "Total",     value: stats.total,         color: "text-foreground" },
    { label: "Active",    value: stats.active,         color: "text-success" },
    { label: "Sent",      value: stats.sent,           color: "text-blue-400" },
    { label: "Scheduled", value: stats.scheduled,      color: "text-warning" },
    { label: "Delivered", value: stats.totalDelivered, color: "text-purple-400" },
    { label: "Read Rate", value: `${stats.readRate}%`, color: "text-success" },
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {cards.map(({ label, value, color }) => (
        <div key={label} className="rounded-xl border border-border/50 bg-card p-3 text-center">
          <div className={`text-xl font-bold ${color}`}>{String(value ?? 0)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function AdminNotifications() {
  const [notifs, setNotifs]         = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [stats, setStats]           = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [statusFilter, setStatus]   = useState("");
  const [typeFilter, setType]       = useState("");
  const [search, setSearch]         = useState("");
  const [modal, setModal]           = useState<Partial<Notification> | null>(null);
  const [analyticsFor, setAnalytics] = useState<Notification | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter)   params.type   = typeFilter;
      if (search)       params.search = search;
      const [listRes, statsRes] = await Promise.allSettled([
        adminNotifications.list(params),
        adminNotifications.stats(),
      ]);
      if (listRes.status === "fulfilled") {
        setNotifs(listRes.value.notifications);
        setPagination(listRes.value.pagination);
      }
      if (statsRes.status === "fulfilled") setStats(statsRes.value.stats);
    } catch { toast.error("Failed to load notifications"); }
    finally { setLoading(false); }
  }, [page, statusFilter, typeFilter, search]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Partial<Notification>) {
    if (data._id) { await adminNotifications.update(data._id, data); toast.success("Updated"); }
    else          { await adminNotifications.create(data);           toast.success("Created"); }
    load();
  }

  async function handleSend(notif: Notification) {
    try {
      const res = await adminNotifications.send(notif._id);
      toast.success(`Sent to ${res.sentCount} users`);
      load();
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  async function handleActivate(notif: Notification) {
    try { await adminNotifications.activate(notif._id); toast.success("Activated"); load(); }
    catch (e: unknown) { toast.error((e as Error).message); }
  }

  async function handleDeactivate(notif: Notification) {
    try { await adminNotifications.deactivate(notif._id); toast.success("Deactivated"); load(); }
    catch (e: unknown) { toast.error((e as Error).message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this notification?")) return;
    try { await adminNotifications.delete(id); toast.success("Deleted"); load(); }
    catch (e: unknown) { toast.error((e as Error).message); }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create, schedule, and broadcast platform notifications</p>
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

        {/* Stats */}
        <StatsBar stats={stats} />

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search notifications…"
            className="rounded-lg border border-border/60 bg-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-48"
          />
          <div className="flex gap-1.5 flex-wrap">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }}
                className={["px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-primary text-primary-foreground" : "border border-border/60 hover:bg-muted"].join(" ")}>
                {s || "All"}
              </button>
            ))}
          </div>
          <select value={typeFilter} onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="rounded-lg border border-border/60 bg-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All Types</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* List */}
        <div className="space-y-2">
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
              <p className="text-sm">No notifications found</p>
            </div>
          ) : notifs.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            const canEdit   = n.status !== "sent" && n.status !== "cancelled";
            const canSend   = n.status === "draft" || n.status === "scheduled";
            const canActivate   = n.status === "draft" || n.status === "scheduled";
            const canDeactivate = n.status === "active" || n.status === "sent";
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
                      {n.isBanner && <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">banner</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />
                        {n.targetType === "plan" ? `${n.targetPlan} plan` : n.targetType === "role" ? `${n.targetRole} role` : "all users"}
                      </span>
                      {n.sentCount > 0 && <span className="flex items-center gap-1"><Send className="h-3 w-3" />{n.sentCount} sent</span>}
                      {n.readCount > 0 && <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{n.readCount} read</span>}
                      {n.scheduledAt && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtLocal(n.scheduledAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                      {n.expiresAt && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Expires {fmtLocal(n.expiresAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                      <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                      {n.createdBy && <span>by {n.createdBy.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    {/* Analytics */}
                    {(n.status === "sent" || n.status === "active") && (
                      <button onClick={() => setAnalytics(n)} title="Analytics"
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-blue-500/10 hover:text-blue-400 transition-colors">
                        <BarChart2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Send */}
                    {canSend && (
                      <button onClick={() => handleSend(n)} title="Send now"
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-success/10 hover:text-success transition-colors">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Activate */}
                    {canActivate && (
                      <button onClick={() => handleActivate(n)} title="Activate (persistent)"
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-success/10 hover:text-success transition-colors">
                        <ToggleLeft className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Deactivate */}
                    {canDeactivate && (
                      <button onClick={() => handleDeactivate(n)} title="Deactivate"
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-warning/10 hover:text-warning transition-colors">
                        <ToggleRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Edit */}
                    {canEdit && (
                      <button onClick={() => setModal(n)} title="Edit"
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Delete */}
                    <button onClick={() => handleDelete(n._id)} title="Delete"
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
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

      {modal    && <NotifModal notif={modal} onClose={() => setModal(null)} onSave={handleSave} />}
      {analyticsFor && <AnalyticsModal notif={analyticsFor} onClose={() => setAnalytics(null)} />}
    </AdminLayout>
  );
}
