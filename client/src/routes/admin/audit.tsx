import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminAudit, type AuditEntry, type Pagination } from "@/lib/adminApi";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Info, Zap } from "lucide-react";

export const Route = createFileRoute("/admin/audit")({
  component: AdminAudit,
});

const SEVERITY_STYLES: Record<string, string> = {
  info:     "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  warning:  "bg-warning/10 text-warning border border-warning/20",
  critical: "bg-destructive/10 text-destructive border border-destructive/20",
};

const SEVERITY_ICONS = {
  info:     Info,
  warning:  AlertTriangle,
  critical: Zap,
};

const CATEGORIES = ["auth", "users", "roles", "sessions", "plans", "notifications", "system", "reports", "content", "topics", "ml", "config"];

function AdminAudit() {
  const [logs, setLogs]           = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [category, setCategory]   = useState("");
  const [severity, setSeverity]   = useState("");
  const [expanded, setExpanded]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 50 };
      if (search)   params.search   = search;
      if (category) params.category = category;
      if (severity) params.severity = severity;
      const res = await adminAudit.list(params);
      setLogs(res.logs);
      setPagination(res.pagination);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, search, category, severity]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Audit Logs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Immutable record of all admin actions — {pagination.total} entries
            </p>
          </div>
          <button
            onClick={load}
            className="h-9 w-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search actions…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border/60 bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
            className="rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Severity</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Log list */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          {loading ? (
            <div className="divide-y divide-border/30">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="px-4 py-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-16 rounded bg-muted" />
                    <div className="h-4 flex-1 rounded bg-muted" />
                    <div className="h-4 w-24 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No audit logs found</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {logs.map((log) => {
                const Icon = SEVERITY_ICONS[log.severity] ?? Info;
                const isExpanded = expanded === log._id;
                return (
                  <div
                    key={log._id}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : log._id)}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Icon className={`h-4 w-4 shrink-0 ${
                        log.severity === "critical" ? "text-destructive" :
                        log.severity === "warning"  ? "text-warning" : "text-blue-400"
                      }`} />

                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${SEVERITY_STYLES[log.severity]}`}
                      >
                        {log.severity}
                      </span>

                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
                        {log.category}
                      </span>

                      <span className="text-sm flex-1 truncate">{log.action}</span>

                      <span className="text-xs text-muted-foreground shrink-0">{log.adminName}</span>

                      <span className="text-xs text-muted-foreground shrink-0 font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-3 ml-7 space-y-2 text-xs text-muted-foreground border-t border-border/30 pt-3">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                          <div><span className="font-medium text-foreground">Admin:</span> {log.adminEmail}</div>
                          <div><span className="font-medium text-foreground">IP:</span> {log.ip || "—"}</div>
                          {log.targetType && <div><span className="font-medium text-foreground">Target:</span> {log.targetType} — {log.targetName || log.targetId}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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
    </AdminLayout>
  );
}
