import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminSessions, type Pagination } from "@/lib/adminApi";
import { toast } from "sonner";
import {
  Search, RefreshCw, Trash2, ChevronLeft, ChevronRight,
  Mic, Users, Clock, Activity, Wifi,
} from "lucide-react";

export const Route = createFileRoute("/admin/sessions")({
  component: AdminSessions,
});

type Session = {
  _id: string;
  sessionId: string;
  topic: string;
  type: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  participants: unknown[];
  hostId?: { name: string; email: string };
};

function AdminSessions() {
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [live, setLive]           = useState<unknown[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [stats, setStats]         = useState<Record<string, unknown>>({});
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [status, setStatus]       = useState("");
  const [type, setType]           = useState("");
  const [page, setPage]           = useState(1);
  const [tab, setTab]             = useState<"all" | "live">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (status) params.status = status;
      if (type)   params.type   = type;
      const [res, liveRes, statsRes] = await Promise.allSettled([
        adminSessions.list(params),
        adminSessions.live(),
        adminSessions.stats(),
      ]);
      if (res.status === "fulfilled") { setSessions(res.value.sessions as Session[]); setPagination(res.value.pagination); }
      if (liveRes.status === "fulfilled") setLive(liveRes.value.sessions);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.stats);
    } catch { toast.error("Failed to load sessions"); }
    finally { setLoading(false); }
  }, [page, search, status, type]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(sessionId: string) {
    if (!confirm("Delete this session?")) return;
    try {
      await adminSessions.delete(sessionId);
      toast.success("Session deleted");
      load();
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active:  "bg-success/10 text-success border border-success/20",
      waiting: "bg-warning/10 text-warning border border-warning/20",
      ended:   "bg-muted text-muted-foreground",
    };
    return map[s] ?? "bg-muted text-muted-foreground";
  };

  const formatDuration = (s?: number) => {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Session Monitoring</h1>
            <p className="text-sm text-muted-foreground mt-1">{pagination.total} total sessions</p>
          </div>
          <button onClick={load} className="h-9 w-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Total",      value: (stats.total      as number) ?? 0, icon: Mic,      color: "text-violet-400" },
            { label: "Active",     value: (stats.active     as number) ?? 0, icon: Activity, color: "text-green-400" },
            { label: "Live (mem)", value: (stats.live       as number) ?? 0, icon: Wifi,     color: "text-cyan-400" },
            { label: "Group",      value: (stats.group      as number) ?? 0, icon: Users,    color: "text-blue-400" },
            { label: "Today",      value: (stats.today      as number) ?? 0, icon: Clock,    color: "text-amber-400" },
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

        {/* Tabs */}
        <div className="flex gap-2">
          {(["all", "live"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === t ? "bg-primary text-primary-foreground" : "border border-border/60 hover:bg-muted",
              ].join(" ")}
            >
              {t === "all" ? "All Sessions" : `Live (${live.length})`}
            </button>
          ))}
        </div>

        {tab === "live" ? (
          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Live Sessions in Memory</h3>
            {live.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No live sessions</p>
            ) : (
              <div className="space-y-3">
                {(live as Array<{ id: string; topic: string; participants: unknown[] }>).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                    <div>
                      <div className="font-medium text-sm">{s.topic}</div>
                      <div className="text-xs text-muted-foreground font-mono">{s.id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                      <span className="text-xs text-muted-foreground">{s.participants?.length ?? 0} participants</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search topic…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border/60 bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="waiting">Waiting</option>
                <option value="ended">Ended</option>
              </select>
              <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}
                className="rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">All Types</option>
                <option value="group">Group</option>
                <option value="individual">Individual</option>
              </select>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Session</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Participants</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Started</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse" /></td>
                        ))}</tr>
                      ))
                    ) : sessions.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No sessions found</td></tr>
                    ) : sessions.map((s) => (
                      <tr key={s._id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium line-clamp-1 max-w-xs">{s.topic}</div>
                          <div className="text-xs text-muted-foreground font-mono">{s.sessionId}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize">{s.type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(s.status)}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">{s.participants?.length ?? 0}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDuration(s.duration)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(s.startedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDelete(s.sessionId)}
                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">{pagination.total} total</span>
                  <div className="flex items-center gap-2">
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
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
