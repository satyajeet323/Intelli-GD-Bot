import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminSystem } from "@/lib/adminApi";
import { toast } from "sonner";
import {
  Server, Database, Flag, Settings, RefreshCw,
  CheckCircle, XCircle, Activity, HardDrive, Cpu,
} from "lucide-react";

export const Route = createFileRoute("/admin/system")({
  component: AdminSystem,
});

type HealthData = {
  status: string;
  uptime: number;
  memory: { heapUsed: number; heapTotal: number; rss: number };
  nodeVersion: string;
  platform: string;
  wsClients: number;
  liveSessions: number;
  env: string;
  ts: string;
};

type DbStats = {
  dbName: string;
  collections: number;
  objects: number;
  dataSize: number;
  storageSize: number;
  indexes: number;
  indexSize: number;
  collectionList: string[];
};

type FeatureFlag = {
  _id: string;
  key: string;
  value: boolean;
  description: string;
  updatedAt: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

function AdminSystem() {
  const [tab, setTab]           = useState<"health" | "db" | "flags">("health");
  const [health, setHealth]     = useState<HealthData | null>(null);
  const [dbStats, setDbStats]   = useState<DbStats | null>(null);
  const [flags, setFlags]       = useState<FeatureFlag[]>([]);
  const [loading, setLoading]   = useState(true);
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [h, db, f] = await Promise.allSettled([
        adminSystem.health(),
        adminSystem.dbStats(),
        adminSystem.featureFlags(),
      ]);
      if (h.status  === "fulfilled") setHealth((h.value  as { health: HealthData }).health);
      if (db.status === "fulfilled") setDbStats((db.value as { stats: DbStats }).stats);
      if (f.status  === "fulfilled") setFlags((f.value   as { flags: FeatureFlag[] }).flags);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function toggleFlag(flag: FeatureFlag) {
    setTogglingFlag(flag.key);
    try {
      await adminSystem.updateFlag(flag.key, !flag.value);
      toast.success(`Flag "${flag.key}" ${!flag.value ? "enabled" : "disabled"}`);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setTogglingFlag(null);
    }
  }

  const tabs = [
    { id: "health", label: "Health", icon: Activity },
    { id: "db",     label: "Database", icon: Database },
    { id: "flags",  label: "Feature Flags", icon: Flag },
  ] as const;

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">System</h1>
            <p className="text-sm text-muted-foreground mt-1">Health, database, and feature management</p>
          </div>
          <button
            onClick={load}
            className="h-9 w-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === t.id ? "bg-primary text-primary-foreground" : "border border-border/60 hover:bg-muted",
              ].join(" ")}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Health tab */}
        {tab === "health" && (
          <div className="space-y-4">
            {/* Status banner */}
            <div className={[
              "rounded-2xl border p-5 flex items-center gap-4",
              health?.status === "ok"
                ? "border-success/30 bg-success/5"
                : "border-destructive/30 bg-destructive/5",
            ].join(" ")}>
              {health?.status === "ok"
                ? <CheckCircle className="h-8 w-8 text-success shrink-0" />
                : <XCircle className="h-8 w-8 text-destructive shrink-0" />
              }
              <div>
                <div className="font-semibold">
                  System {health?.status === "ok" ? "Operational" : "Degraded"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {health ? `Last checked: ${new Date(health.ts).toLocaleTimeString()}` : "Loading…"}
                </div>
              </div>
              <div className="ml-auto text-right text-sm text-muted-foreground">
                <div>Node {health?.nodeVersion}</div>
                <div className="capitalize">{health?.platform}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Uptime",        value: health ? formatUptime(health.uptime) : "—",  icon: Activity, color: "text-green-400" },
                { label: "WS Clients",    value: health?.wsClients ?? "—",                    icon: Server,   color: "text-cyan-400" },
                { label: "Live Sessions", value: health?.liveSessions ?? "—",                 icon: Cpu,      color: "text-violet-400" },
                { label: "Environment",   value: health?.env ?? "—",                          icon: Settings, color: "text-amber-400" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg bg-muted flex items-center justify-center ${s.color}`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-display text-lg font-bold">{loading ? "—" : String(s.value)}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Memory */}
            {health && (
              <div className="rounded-2xl border border-border/50 bg-card p-5">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <HardDrive className="h-4 w-4" /> Memory Usage
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Heap Used",  value: health.memory.heapUsed,  total: health.memory.heapTotal },
                    { label: "Heap Total", value: health.memory.heapTotal, total: health.memory.rss },
                    { label: "RSS",        value: health.memory.rss,       total: health.memory.rss },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{m.label}</span>
                        <span className="font-mono font-medium">{formatBytes(m.value)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, (m.value / (m.total || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DB tab */}
        {tab === "db" && (
          <div className="space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-border/50 bg-card p-6 animate-pulse">
                <div className="h-5 w-32 rounded bg-muted mb-4" />
                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-muted" />
                  ))}
                </div>
              </div>
            ) : dbStats ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Database",    value: dbStats.dbName },
                    { label: "Collections", value: dbStats.collections },
                    { label: "Documents",   value: dbStats.objects.toLocaleString() },
                    { label: "Indexes",     value: dbStats.indexes },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-border/50 bg-card p-4">
                      <div className="font-display text-xl font-bold">{s.value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-border/50 bg-card p-5">
                    <h3 className="font-semibold text-sm mb-4">Storage</h3>
                    <div className="space-y-3">
                      {[
                        { label: "Data Size",    value: dbStats.dataSize },
                        { label: "Storage Size", value: dbStats.storageSize },
                        { label: "Index Size",   value: dbStats.indexSize },
                      ].map((s) => (
                        <div key={s.label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className="font-mono font-medium">{formatBytes(s.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-card p-5">
                    <h3 className="font-semibold text-sm mb-4">Collections</h3>
                    <div className="flex flex-wrap gap-2">
                      {dbStats.collectionList.map((c) => (
                        <span key={c} className="rounded-full bg-muted px-3 py-1 text-xs font-mono">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-border/50 bg-card p-12 text-center text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Database stats unavailable</p>
              </div>
            )}
          </div>
        )}

        {/* Feature flags tab */}
        {tab === "flags" && (
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/50 bg-card p-4 animate-pulse">
                  <div className="h-4 w-48 rounded bg-muted" />
                </div>
              ))
            ) : flags.length === 0 ? (
              <div className="rounded-2xl border border-border/50 bg-card p-12 text-center text-muted-foreground">
                <Flag className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No feature flags configured</p>
                <p className="text-xs mt-1">Feature flags are created via the system config API</p>
              </div>
            ) : (
              flags.map((flag) => (
                <div
                  key={flag._id}
                  className="rounded-xl border border-border/50 bg-card p-4 flex items-center justify-between hover:border-foreground/20 transition-all"
                >
                  <div>
                    <div className="font-mono text-sm font-medium">{flag.key}</div>
                    {flag.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{flag.description}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Updated {new Date(flag.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFlag(flag)}
                    disabled={togglingFlag === flag.key}
                    className={[
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50",
                      flag.value ? "bg-primary" : "bg-muted",
                    ].join(" ")}
                    aria-label={`Toggle ${flag.key}`}
                  >
                    <span
                      className={[
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        flag.value ? "translate-x-6" : "translate-x-1",
                      ].join(" ")}
                    />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
