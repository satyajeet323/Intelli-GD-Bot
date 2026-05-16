import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminAnalytics, adminUsers, adminSessions } from "@/lib/adminApi";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Users, Mic, Activity, Zap, TrendingUp, AlertTriangle,
  Server, Database, Wifi, Clock,
} from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

function StatCard({
  label, value, sub, icon: Icon, color = "text-foreground",
}: {
  label: string; value: string | number; sub?: string;
  icon: typeof Users; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 hover:border-foreground/20 transition-all hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div className={`h-10 w-10 rounded-xl bg-muted flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        {sub && <span className="text-[11px] text-muted-foreground font-mono">{sub}</span>}
      </div>
      <div className="mt-4">
        <div className="font-display text-3xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

function AdminDashboard() {
  const [overview, setOverview]   = useState<Record<string, number>>({});
  const [userStats, setUserStats] = useState<Record<string, unknown>>({});
  const [sessStats, setSessStats] = useState<Record<string, unknown>>({});
  const [perf, setPerf]           = useState<Record<string, unknown>>({});
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.allSettled([
      adminAnalytics.overview(),
      adminUsers.stats(),
      adminSessions.stats(),
      adminAnalytics.performance(),
    ]).then(([ov, us, ss, pf]) => {
      if (ov.status === "fulfilled") setOverview((ov.value as { overview: Record<string, number> }).overview ?? {});
      if (us.status === "fulfilled") setUserStats((us.value as { stats: Record<string, unknown> }).stats ?? {});
      if (ss.status === "fulfilled") setSessStats((ss.value as { stats: Record<string, unknown> }).stats ?? {});
      if (pf.status === "fulfilled") setPerf((pf.value as { performance: Record<string, unknown> }).performance ?? {});
      setLoading(false);
    });
  }, []);

  const growth = (userStats.growth as { _id: string; count: number }[]) ?? [];
  const planDist = [
    { name: "Free", value: (userStats as { free?: number }).free ?? 0 },
    { name: "Pro",  value: (userStats as { pro?: number }).pro  ?? 0 },
  ];
  const dailySessions = (sessStats.dailyActivity as { _id: string; count: number }[]) ?? [];
  const latency = (perf.latency as { p50?: number; p95?: number; p99?: number; avg?: number }) ?? {};

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Platform overview and real-time metrics</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users"     value={loading ? "—" : overview.totalUsers ?? 0}     sub={`+${overview.newUsersToday ?? 0} today`} icon={Users}    color="text-blue-400" />
          <StatCard label="Total Sessions"  value={loading ? "—" : overview.totalSessions ?? 0}  sub={`${overview.activeSessions ?? 0} active`} icon={Mic}     color="text-violet-400" />
          <StatCard label="Live Connections" value={loading ? "—" : overview.wsConnections ?? 0} sub="WebSocket"  icon={Wifi}     color="text-cyan-400" />
          <StatCard label="Avg Latency"     value={loading ? "—" : `${overview.avgLatencyMs ?? 0}ms`} sub="API"  icon={Zap}      color="text-amber-400" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Live Sessions"   value={loading ? "—" : overview.liveSessionsInMemory ?? 0} sub="in memory" icon={Activity} color="text-green-400" />
          <StatCard label="API Calls"       value={loading ? "—" : overview.apiCalls ?? 0}             sub="since start" icon={TrendingUp} color="text-indigo-400" />
          <StatCard label="Failed Logins"   value={loading ? "—" : overview.failedLogins ?? 0}         sub="since start" icon={AlertTriangle} color="text-red-400" />
          <StatCard label="Uptime"          value={loading ? "—" : formatUptime((perf.uptime as number) ?? 0)} sub="server" icon={Clock} color="text-emerald-400" />
        </div>

        {/* Charts row 1 */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* User growth */}
          <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">User Growth (30 days)</h3>
            {loading ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={growth}>
                  <defs>
                    <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#ug)" strokeWidth={2} name="New Users" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Plan distribution */}
          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Plan Distribution</h3>
            {loading ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={planDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {planDist.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Daily sessions */}
          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Daily Sessions (30 days)</h3>
            {loading ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailySessions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Sessions" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Performance metrics */}
          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">API Latency Percentiles</h3>
            {loading ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : (
              <div className="space-y-4 mt-6">
                {[
                  { label: "P50 (median)", value: latency.p50 ?? 0, max: 500 },
                  { label: "P95",          value: latency.p95 ?? 0, max: 500 },
                  { label: "P99",          value: latency.p99 ?? 0, max: 500 },
                  { label: "Average",      value: latency.avg ?? 0, max: 500 },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{m.label}</span>
                      <span className="font-mono font-medium">{m.value}ms</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, (m.value / m.max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-2 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-muted-foreground">Memory</div>
                    <div className="font-mono font-semibold mt-0.5">{(perf.memoryMB as number) ?? 0} MB</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-muted-foreground">Error Rate</div>
                    <div className="font-mono font-semibold mt-0.5">{(perf.errorRate as string) ?? "0"}%</div>
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
