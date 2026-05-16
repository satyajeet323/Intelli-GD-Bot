import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Calendar, Clock, MessageCircle, Download, Loader2, Inbox, Users } from "lucide-react";
import { history, type HistoryEntry } from "@/lib/api";
import { usePageFocus } from "@/hooks/usePageFocus";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Session History — GD Bot" },
      { name: "description", content: "Browse all your past group discussion sessions on a timeline." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [sessions, setSessions] = useState<HistoryEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    history
      .list({ sort: "newest", limit: 50 })
      .then((res) => setSessions(res.sessions))
      .catch((err: Error) => setError(err.message ?? "Failed to load history."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refetch when the tab regains focus (user returns after a session)
  usePageFocus(load);

  return (
    <div className="px-4 sm:px-8 py-8 max-w-5xl mx-auto animate-fade-in">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Archive</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Session <span className="gradient-text">timeline</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">Every discussion, every score, in order.</p>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading your sessions…</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-destructive text-sm">
          {error}
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="rounded-2xl border border-border/50 bg-card p-12 text-center">
          <Inbox className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground text-sm">No sessions yet — complete a discussion to see it here.</p>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="relative">
          {/* spine */}
          <div className="absolute left-4 sm:left-6 top-2 bottom-2 w-px bg-gradient-to-b from-foreground/30 via-foreground/10 to-transparent" />

          <ul className="space-y-5">
            {sessions.map((s, i) => (
              <li
                key={s.sessionId}
                className="relative pl-12 sm:pl-16 animate-fade-up"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {/* node */}
                <span className="absolute left-2.5 sm:left-4.5 top-6 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />

                <div className="rounded-2xl border border-border/50 bg-card p-5 hover:border-foreground/20 hover:shadow-glow transition-all">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {new Date(s.date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> {s.durationFormatted}
                    </span>
                    {s.myReport && (
                      <span className="inline-flex items-center gap-1.5">
                        <MessageCircle className="h-3 w-3" /> {s.myReport.turns} turns
                      </span>
                    )}
                    <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-background/40 border border-border/50">
                      {s.type}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-medium leading-snug">{s.topic}</h3>

                  {s.myReport ? (
                    <div className="mt-5 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Stat label="Overall"    value={s.myReport.combinedScore ?? s.myReport.overallScore} highlight />
                        <Stat label="Fluency"    value={s.myReport.fluency} />
                        <Stat label="Relevance"  value={s.myReport.relevance} />
                        <Stat label="Confidence" value={s.myReport.confidence} />
                      </div>
                      {/* Peer + combined scores */}
                      {(s.myReport.peerScore != null || s.myReport.combinedScore != null) && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {s.myReport.peerScore != null && (
                            <Stat label="Peer score" value={s.myReport.peerScore} color="cyan" />
                          )}
                          {s.myReport.combinedScore != null && (
                            <Stat label="Combined" value={s.myReport.combinedScore} color="success" />
                          )}
                        </div>
                      )}
                      {/* Peer feedback text */}
                      {s.myReport.peerFeedback && (
                        <div className="rounded-xl bg-background/30 border border-border/40 px-4 py-3">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                            <Users className="h-3 w-3" /> Peer feedback
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                            {s.myReport.peerFeedback}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground italic">No report data for this session.</p>
                  )}

                  <div className="mt-5 flex items-center gap-2">
                    <Link
                      to="/report/$sessionId"
                      params={{ sessionId: s.sessionId }}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-80 transition"
                    >
                      View report
                    </Link>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg glass px-4 py-2 text-sm hover:shadow-glow transition opacity-50 cursor-not-allowed"
                      disabled
                      title="PDF export coming soon"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight, color }: { label: string; value: number; highlight?: boolean; color?: "cyan" | "success" }) {
  const bgClass = highlight
    ? "bg-foreground/8 border border-foreground/20"
    : "bg-muted/40 border border-border/50";

  const textClass = highlight ? "gradient-text" : "";

  return (
    <div className={`rounded-xl px-3 py-2 ${bgClass}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-display text-xl font-bold ${textClass}`}>{value.toFixed(1)}</div>
    </div>
  );
}
