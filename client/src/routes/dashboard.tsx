import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { TrendingUp, Mic, Trophy, Flame, ArrowUpRight, Play, Users } from "lucide-react";
import { history, type HistoryEntry } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePageFocus } from "@/hooks/usePageFocus";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — GD Bot" },
      { name: "description", content: "Your fluency stats and recent group discussion sessions." },
    ],
  }),
  component: Dashboard,
});

type Stats = {
  totalSessions:   number;
  avgOverallScore: number;
  avgFluency:      number;
  streak:          number;
};

function Dashboard() {
  const { user }  = useCurrentUser();
  const [recent,  setRecent]  = useState<HistoryEntry[]>([]);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [histRes, statsRes] = await Promise.allSettled([
        history.list({ limit: 3, sort: "newest" }),
        history.stats(),
      ]);

      if (histRes.status === "fulfilled")  setRecent(histRes.value.sessions);
      if (statsRes.status === "fulfilled") {
        const s = (statsRes.value as { success: boolean; stats: Stats }).stats;
        setStats(s);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Refetch whenever the tab regains focus (user returns from a session)
  usePageFocus(load);

  const statCards = [
    {
      label: "Avg Score",
      value: stats ? stats.avgOverallScore.toFixed(1) : "—",
      delta: stats ? `${stats.totalSessions} sessions` : "",
      icon:  Trophy,
    },
    {
      label: "Sessions",
      value: stats ? String(stats.totalSessions) : "—",
      delta: stats && stats.totalSessions > 0 ? "total" : "",
      icon:  Mic,
    },
    {
      label: "Fluency",
      value: stats ? `${Math.round(stats.avgFluency * 10)}%` : "—",
      delta: stats ? `avg ${stats.avgFluency.toFixed(1)}/10` : "",
      icon:  TrendingUp,
    },
    {
      label: "Streak",
      value: stats ? `${stats.streak}d` : "—",
      delta: stats && stats.streak > 0 ? "🔥" : "",
      icon:  Flame,
    },
  ];

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto space-y-8 animate-fade-in">

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-card p-8 sm:p-10">
        <div className="relative flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Welcome back, {firstName}
            </p>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Ready for today's <span className="gradient-text">discussion?</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Record your speech, get Whisper transcription, CRNN filler detection, and a full Gemini-powered fluency report.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/gd/$sessionId"
              params={{ sessionId: "new" }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-semibold hover:opacity-80 transition"
            >
              <Play className="h-4 w-4 fill-current" /> Start Fluency Session
            </Link>
            <Link
              to="/group-session"
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-6 py-3 font-semibold hover:bg-muted transition"
            >
              <Users className="h-4 w-4" />
              Start Group Session
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border/50 bg-card p-5 hover:border-foreground/20 hover:shadow-glow transition-all hover:-translate-y-0.5 animate-fade-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <s.icon className="h-5 w-5 text-foreground" />
              </div>
              {s.delta && <span className="text-[11px] font-mono text-muted-foreground">{s.delta}</span>}
            </div>
            <div className="mt-4">
              {loading
                ? <div className="h-8 w-16 rounded-lg bg-muted animate-pulse" />
                : <div className="font-display text-3xl font-bold">{s.value}</div>
              }
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Recent sessions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">Recent sessions</h2>
          <Link to="/history" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card p-5 animate-pulse">
                <div className="h-3 w-24 rounded bg-muted mb-3" />
                <div className="h-4 w-full rounded bg-muted mb-2" />
                <div className="h-4 w-3/4 rounded bg-muted mb-5" />
                <div className="h-8 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-10 text-center text-muted-foreground">
            <Mic className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No sessions yet — start your first discussion above.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map((s, i) => (
              <Link
                key={s.sessionId}
                to="/report/$sessionId"
                params={{ sessionId: s.sessionId }}
                className="group rounded-2xl border border-border/50 bg-card p-5 hover:border-foreground/20 hover:shadow-glow hover:-translate-y-1 transition-all animate-fade-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  <span>{s.durationFormatted}</span>
                </div>
                <h3 className="mt-3 font-medium leading-snug line-clamp-2 group-hover:text-foreground transition-colors">
                  {s.topic}
                </h3>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <div className="font-display text-3xl font-bold gradient-text">
                      {s.myReport ? s.myReport.overallScore.toFixed(1) : "—"}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Overall</div>
                  </div>
                  {s.myReport && (
                    <div className="flex gap-1">
                      {Array.from({ length: 10 }).map((_, idx) => (
                        <span
                          key={idx}
                          className={`h-6 w-1 rounded-full ${idx < Math.round(s.myReport!.overallScore) ? "bg-foreground" : "bg-border"}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
