import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminAnalytics } from "@/lib/adminApi";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, Users, Mic, Zap, Shield, AlertTriangle,
  Activity, Server, RefreshCw, Clock,
} from "lucide-react";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

function MetricCard({ label, value, sub, icon: Icon, color = "" }: {
  label: string; value: string | number; sub?: string;
  icon: typeof TrendingUp; color?: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg bg-muted flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="font-display text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {sub && <div className="text-[10px] text-muted-foreground font-mono">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function AdminAnalytics() {
  const [days, setDays]         = useState(30);
  const [overview, setOverview] = useState<Record<string, unknown>>({});
  const [userAn, setUserAn]     = useState<Record<string, unknown>>({});
  const [sessAn, setSessAn]     = useState<Record<string, unknown>>({});
  const [perf, setPerf]         = useState<Record<string, unknown>>({});
  const [security, setSecurity] = useState<Record<string, unknown>>({});
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [ov, ua, sa, pf, sec] = await Promise.allSettled([
        adminAnalytics.overview(),
        adminAnalytics.users(days),
        adminAnalytics.sessions(days),
        adminAnalytics.performance(),
        adminAnalytics.security(),
      ]);
      if (ov.status  === "fulfilled") setOverview((ov.value  as { overview: Record<string, unknown> }).overview ?? {});
      if (ua.status  === "fulfilled") setUserAn(ua.value  as Record<string, unknown>);
      if (sa.status  === "fulfilled") setSessAn(sa.value  as Record<string, unknown>);
      if (pf.status  === "fulfilled") setPerf((pf.value   as { performance: Record<string, unknown> }).performance ?? {});
      if (sec.status === "fulfilled") setSecurity((sec.value as { security: Record<string, unknown> }).security ?? {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [days]);

  const growth      = (userAn.growth      as { _id: string; count: number }[]) ?? [];
  const planDist    = (userAn.planDistribution as { _id: string; count: number }[]) ?? [];
  const dailySess   = (sessAn.daily       as { _id: string; count: number }[]) ?? [];
  const topTopics   = (sessAn.topTopics   as { _id: string; count: number }[]) ?? [];
  const avgScores   = (sessAn.avgScores   as Record<string, number>) ?? {};
  const latency     = (perf.latency       as Record<string, number>) ?? {};
  const recentAlerts = (security.recentAlerts as { _id: string; action: string; severity: string; adminName: string; createdAt: string }[]) ?? [];

  const tooltipStyle = {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">Platform-wide metrics and insights</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={load}
              className="h-9 w-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Overview KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Users"    value={(overview.totalUsers    as number) ?? 0} sub={`+${(overview.newUsersToday as number) ?? 0} today`} icon={Users}    color="text-blue-400" />
          <MetricCard label="Total Sessions" value={(overview.totalSessions as number) ?? 0} sub={`${(overview.activeSessions as number) ?? 0} active`} icon={Mic}     color="text-violet-400" />
          <MetricCard label="WS Connections" value={(overview.wsConnections as number) ?? 0} sub="live"       icon={Activity} color="text-cyan-400" />
          <MetricCard label="Avg Latency"    value={`${(overview.avgLatencyMs as number) ?? 0}ms`} sub="API"  icon={Zap}      color="text-amber-400" />
        </div>

        {/* User growth + plan dist */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">User Growth</h3>
            {loading ? <div className="h-52 bg-muted animate-pulse rounded-lg" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={growth}>
                  <defs>
                    <linearGradient id="ug2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#ug2)" strokeWidth={2} name="New Users" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Plan Distribution</h3>
            {loading ? <div className="h-52 bg-muted animate-pulse rounded-lg" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={planDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="count" paddingAngle={3} nameKey="_id">
                    {planDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Session activity + top topics */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Daily Sessions</h3>
            {loading ? <div className="h-52 bg-muted animate-pulse rounded-lg" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailySess}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Sessions" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Top Topics</h3>
            {loading ? <div className="h-52 bg-muted animate-pulse rounded-lg" /> : (
              <div className="space-y-2.5">
                {topTopics.slice(0, 8).map((t, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground truncate max-w-[160px]">{t._id}</span>
                      <span className="font-mono font-medium shrink-0 ml-2">{t.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(t.count / (topTopics[0]?.count || 1)) * 100}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Performance + avg scores */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">API Performance</h3>
            {loading ? <div className="h-48 bg-muted animate-pulse rounded-lg" /> : (
              <div className="space-y-4">
                {[
                  { label: "P50 Latency", value: latency.p50 ?? 0, max: 500, color: "#10b981" },
                  { label: "P95 Latency", value: latency.p95 ?? 0, max: 500, color: "#f59e0b" },
                  { label: "P99 Latency", value: latency.p99 ?? 0, max: 500, color: "#ef4444" },
                  { label: "Avg Latency", value: latency.avg ?? 0, max: 500, color: "#6366f1" },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{m.label}</span>
                      <span className="font-mono font-medium">{m.value}ms</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (m.value / m.max) * 100)}%`, background: m.color }}
                      />
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <div className="text-muted-foreground">Memory</div>
                    <div className="font-mono font-semibold mt-0.5">{(perf.memoryMB as number) ?? 0}MB</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <div className="text-muted-foreground">Error Rate</div>
                    <div className="font-mono font-semibold mt-0.5">{(perf.errorRate as string) ?? "0"}%</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <div className="text-muted-foreground">Uptime</div>
                    <div className="font-mono font-semibold mt-0.5">
                      {Math.floor(((perf.uptime as number) ?? 0) / 3600)}h
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Avg Session Scores</h3>
            {loading ? <div className="h-48 bg-muted animate-pulse rounded-lg" /> : (
              <div className="space-y-3">
                {[
                  { label: "Overall Score",  value: avgScores.avgScore      ?? 0, max: 10 },
                  { label: "Fluency",        value: avgScores.avgFluency    ?? 0, max: 10 },
                  { label: "Relevance",      value: avgScores.avgRelevance  ?? 0, max: 10 },
                  { label: "Confidence",     value: avgScores.avgConfidence ?? 0, max: 10 },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{m.label}</span>
                      <span className="font-mono font-medium">{(m.value as number).toFixed(1)} / {m.max}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${((m.value as number) / m.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-border/50">
                  <h4 className="text-xs font-medium text-muted-foreground mb-3">Security Alerts</h4>
                  <div className="space-y-2">
                    {recentAlerts.slice(0, 4).map((a) => (
                      <div key={a._id} className="flex items-center gap-2 text-xs">
                        <AlertTriangle className={`h-3 w-3 shrink-0 ${a.severity === "critical" ? "text-destructive" : "text-warning"}`} />
                        <span className="text-muted-foreground truncate">{a.action}</span>
                        <span className="text-muted-foreground shrink-0 ml-auto">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    {recentAlerts.length === 0 && (
                      <p className="text-xs text-muted-foreground">No recent alerts</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
