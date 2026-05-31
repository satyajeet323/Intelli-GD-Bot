import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { TrendingUp, Mic, Trophy, Flame, ArrowUpRight, Play, Users, Target, Zap, ShieldCheck } from "lucide-react";
import { history, type HistoryEntry } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePageFocus } from "@/hooks/usePageFocus";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — INTELLI BOT" },
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

/* ── Animated counter ─────────────────────────────────────────────────────── */
function useCountUp(target: string, active: boolean) {
  const [display, setDisplay] = useState("—");
  useEffect(() => {
    if (!active) return;
    const num = parseFloat(target);
    if (isNaN(num)) { setDisplay(target); return; }
    const dur = 1200;
    const step = (ts: number, t0: number) => {
      const p = Math.min((ts - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(target.includes(".") ? (ease * num).toFixed(1) : String(Math.floor(ease * num)));
      if (p < 1) requestAnimationFrame((t) => step(t, t0));
      else setDisplay(target);
    };
    requestAnimationFrame((t) => step(t, t));
  }, [active, target]);
  return display;
}

/* ── Ticker ───────────────────────────────────────────────────────────────── */
const TICKER_ITEMS = [
  "FLUENCY ANALYSIS", "CONFIDENCE SCORING", "GRAMMAR CHECK",
  "PITCH DETECTION", "FILLER WORD MONITOR", "REAL-TIME FEEDBACK",
  "GROUP SESSIONS", "LEADERBOARD", "TOPIC GENERATION", "VOICE SYNTHESIS",
];

function Ticker() {
  return (
    <div style={{ overflow: "hidden", borderBottom: "1px solid var(--ib-bdr)", background: "var(--ib-surf)", padding: "8px 0" }}>
      <div style={{ display: "flex", gap: "3rem", animation: "ib-ticker 22s linear infinite", whiteSpace: "nowrap" }}>
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.15em", color: "var(--ib-amber)", display: "flex", alignItems: "center", gap: "1rem" }}>
            {item} <span style={{ color: "var(--ib-bdr)" }}>◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────────────── */
function StatCard({ label, rawValue, delta, icon: Icon, active, delay }: {
  label: string; rawValue: string; delta: string; icon: typeof Trophy; active: boolean; delay: number;
}) {
  const display = useCountUp(rawValue, active);
  return (
    <div
      className="animate-fade-up p-5"
      style={{
        background: "var(--ib-card)",
        border: "1px solid var(--ib-bdr)",
        borderBottom: "2px solid var(--ib-amber)",
        animationDelay: `${delay}ms`,
        animationFillMode: "both",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="h-9 w-9 flex items-center justify-center"
          style={{ background: "var(--ib-surf)", border: "1px solid var(--ib-bdr)" }}
        >
          <Icon className="h-4 w-4" style={{ color: "var(--ib-amber)" }} />
        </div>
        {delta && (
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", color: "var(--ib-muted)", textTransform: "uppercase" }}>
            {delta}
          </span>
        )}
      </div>
      <div className="font-display text-3xl gradient-text">{display}</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-mut2)", marginTop: "2px" }}>
        {label}
      </div>
    </div>
  );
}

/* ── Progress bar row ─────────────────────────────────────────────────────── */
function ProgressRow({ label, value, max = 10, color = "var(--ib-amber)" }: {
  label: string; value: number; max?: number; color?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-mut2)" }}>
          {label}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem", fontWeight: 700, color }}>
          {value.toFixed(1)}
        </span>
      </div>
      <div style={{ height: "4px", background: "var(--ib-bdr)", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: "0 auto 0 0",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, var(--ib-gold))`,
            transformOrigin: "left",
            animation: "scaleX-in 0.9s cubic-bezier(0.16,1,0.3,1) forwards",
          }}
        />
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
function Dashboard() {
  const { user }  = useCurrentUser();
  const [recent,  setRecent]  = useState<HistoryEntry[]>([]);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [histRes, statsRes] = await Promise.allSettled([
        history.list({ limit: 5, sort: "newest" }),
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

  useEffect(() => { load(); }, [load]);
  usePageFocus(load);

  const statCards = [
    { label: "Avg Score", rawValue: stats ? stats.avgOverallScore.toFixed(1) : "—", delta: stats ? `${stats.totalSessions} sessions` : "", icon: Trophy },
    { label: "Sessions",  rawValue: stats ? String(stats.totalSessions) : "—",      delta: "total",                                          icon: Mic },
    { label: "Fluency",   rawValue: stats ? `${Math.round(stats.avgFluency * 10)}%` : "—", delta: stats ? `avg ${stats.avgFluency.toFixed(1)}/10` : "", icon: TrendingUp },
    { label: "Streak",    rawValue: stats ? `${stats.streak}d` : "—",               delta: stats && stats.streak > 0 ? "🔥 active" : "",     icon: Flame },
  ];

  const firstName = user?.name?.split(" ")[0] ?? "there";

  // Derived progress metrics from stats
  const fluencyScore   = stats ? stats.avgFluency : 0;
  const overallScore   = stats ? stats.avgOverallScore : 0;
  // Estimate confidence & relevance from overall (placeholder until API exposes them)
  const confidenceEst  = stats ? Math.min(overallScore * 1.05, 10) : 0;
  const relevanceEst   = stats ? Math.min(overallScore * 0.95, 10) : 0;
  const sessionsTarget = 20; // goal sessions

  return (
    <div className="animate-fade-in" style={{ background: "var(--ib-bg)" }}>
      <Ticker />

      <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto space-y-8">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden scanlines p-8 sm:p-10"
          style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}
        >
          <div className="ib-grid-bg" />
          <div className="ib-accent-line absolute left-0 top-0 bottom-0" />

          <div className="relative flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ib-amber)", marginBottom: "0.5rem" }}>
                ● WELCOME BACK, {firstName.toUpperCase()}
              </div>
              <h1 className="font-display text-4xl sm:text-5xl" style={{ color: "var(--ib-fg)", lineHeight: 1 }}>
                Ready for today's{" "}
                <span className="gradient-text">discussion?</span>
              </h1>
              <p className="mt-3 text-sm max-w-md" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
                Record your speech, get Whisper transcription, CRNN filler detection, and a full Gemini-powered fluency report.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link to="/gd/$sessionId" params={{ sessionId: "new" }} className="btn-primary inline-flex items-center gap-2">
                <Play className="h-4 w-4 fill-current" /> Solo AI Session
              </Link>
              <Link to="/group-session" className="btn-ghost inline-flex items-center gap-2">
                <Users className="h-4 w-4" /> Group Session
              </Link>
              {user?.isAdmin && (
                <Link to="/admin/sessions" className="btn-ghost inline-flex items-center gap-2" style={{ borderColor: "var(--ib-amber)", color: "var(--ib-amber)" }}>
                  <ShieldCheck className="h-4 w-4" /> Admin Panel
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ── Stat cards ────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <StatCard key={s.label} {...s} active={!loading} delay={i * 80} />
          ))}
        </section>

        {/* ── Two-column: Recent Sessions + Overall Progress ─────────────── */}
        <div className="grid lg:grid-cols-[1fr,340px] gap-6">

          {/* Recent sessions */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl" style={{ color: "var(--ib-fg)" }}>Recent Sessions</h2>
              <Link
                to="/history"
                className="inline-flex items-center gap-1"
                style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-amber)" }}
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse"
                    style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)", height: 80 }}
                  />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="p-10 text-center" style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}>
                <Mic className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--ib-muted)" }} />
                <p className="text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif" }}>
                  No sessions yet — start your first discussion above.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((s, i) => (
                  <Link
                    key={s.sessionId}
                    to="/report/$sessionId"
                    params={{ sessionId: s.sessionId }}
                    className="ib-card flex items-center gap-4 p-4 block animate-fade-up"
                    style={{ borderLeft: "3px solid var(--ib-amber)", animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
                          {new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
                          {s.durationFormatted}
                        </span>
                      </div>
                      <h3 className="text-sm leading-snug line-clamp-1" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif", fontWeight: 400 }}>
                        {s.topic}
                      </h3>
                    </div>
                    {s.myReport && (
                      <div className="text-right shrink-0">
                        <div className="font-display text-2xl gradient-text">
                          {s.myReport.overallScore.toFixed(1)}
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.45rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
                          Score
                        </div>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Overall Progress panel */}
          <section>
            <h2 className="font-display text-xl mb-4" style={{ color: "var(--ib-fg)" }}>Overall Progress</h2>

            <div
              className="p-5 space-y-5"
              style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}
            >
              {/* Score ring summary */}
              <div className="flex items-center gap-4 pb-4" style={{ borderBottom: "1px solid var(--ib-bdr)" }}>
                {/* Mini circular indicator */}
                <div className="relative shrink-0">
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="var(--ib-bdr)" strokeWidth="5" />
                    <circle
                      cx="32" cy="32" r="26" fill="none"
                      stroke="var(--ib-amber)" strokeWidth="5"
                      strokeDasharray={`${(overallScore / 10) * 163.4} 163.4`}
                      strokeLinecap="butt"
                      transform="rotate(-90 32 32)"
                      style={{ transition: "stroke-dasharray 1s ease" }}
                    />
                    <text x="32" y="36" textAnchor="middle" style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "16px", fill: "var(--ib-fg)" }}>
                      {loading ? "—" : overallScore.toFixed(1)}
                    </text>
                  </svg>
                </div>
                <div>
                  <div className="font-display text-base" style={{ color: "var(--ib-fg)" }}>Avg Overall</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)", marginTop: "2px" }}>
                    across {stats?.totalSessions ?? 0} sessions
                  </div>
                </div>
              </div>

              {/* Metric bars */}
              {loading ? (
                <div className="space-y-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse" style={{ height: 28, background: "var(--ib-surf)", borderRadius: 0 }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <ProgressRow label="Fluency"    value={fluencyScore}   color="var(--ib-amber)" />
                  <ProgressRow label="Confidence" value={confidenceEst}  color="var(--ib-purple)" />
                  <ProgressRow label="Relevance"  value={relevanceEst}   color="var(--ib-gold)" />
                  <ProgressRow label="Sessions"   value={stats?.totalSessions ?? 0} max={sessionsTarget} color="var(--ib-ok)" />
                </div>
              )}

              {/* Sessions goal */}
              <div
                className="pt-4 flex items-center justify-between"
                style={{ borderTop: "1px solid var(--ib-bdr)" }}
              >
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
                    Sessions goal
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.7rem", color: "var(--ib-fg)", marginTop: "2px" }}>
                    {stats?.totalSessions ?? 0} / {sessionsTarget}
                  </div>
                </div>
                <span className="ib-chip">
                  {stats && stats.totalSessions >= sessionsTarget ? "✓ Done" : `${Math.round(((stats?.totalSessions ?? 0) / sessionsTarget) * 100)}%`}
                </span>
              </div>

              {/* Quick action links */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/gd/$sessionId"
                  params={{ sessionId: "new" }}
                  className="flex items-center gap-2 p-3 transition-colors"
                  style={{ background: "var(--ib-surf)", border: "1px solid var(--ib-bdr)" }}
                >
                  <Zap className="h-4 w-4 shrink-0" style={{ color: "var(--ib-amber)" }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ib-fg)" }}>
                    Solo
                  </span>
                </Link>
                <Link
                  to="/group-session"
                  className="flex items-center gap-2 p-3 transition-colors"
                  style={{ background: "var(--ib-surf)", border: "1px solid var(--ib-bdr)" }}
                >
                  <Target className="h-4 w-4 shrink-0" style={{ color: "var(--ib-purple)" }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ib-fg)" }}>
                    Group
                  </span>
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
