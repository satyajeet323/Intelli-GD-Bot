import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Calendar, Clock, MessageCircle, Download, Loader2, Inbox, Users } from "lucide-react";
import { history, type HistoryEntry } from "@/lib/api";
import { usePageFocus } from "@/hooks/usePageFocus";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Session History — INTELLI BOT" },
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
  usePageFocus(load);

  return (
    <div className="px-4 sm:px-8 py-8 max-w-5xl mx-auto animate-fade-in" style={{ background: "var(--ib-bg)" }}>
      <header className="mb-8">
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ib-amber)", marginBottom: "0.5rem" }}>
          Archive
        </div>
        <h1 className="font-display text-4xl" style={{ color: "var(--ib-fg)" }}>
          Session <span className="gradient-text">Timeline</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
          Every discussion, every score, in order.
        </p>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-20 gap-3" style={{ color: "var(--ib-mut2)" }}>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.7rem", letterSpacing: "0.1em" }}>Loading your sessions…</span>
        </div>
      )}

      {!loading && error && (
        <div className="p-8 text-center text-sm" style={{ background: "var(--ib-card)", border: "1px solid rgba(220,138,107,0.3)", color: "var(--ib-terra)" }}>
          {error}
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="p-12 text-center" style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}>
          <Inbox className="h-10 w-10 mx-auto mb-4" style={{ color: "var(--ib-muted)" }} />
          <p className="text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif" }}>
            No sessions yet — complete a discussion to see it here.
          </p>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="relative">
          {/* Timeline spine */}
          <div
            className="absolute left-4 sm:left-6 top-2 bottom-2 w-px"
            style={{ background: "linear-gradient(to bottom, var(--ib-amber), var(--ib-bdr), transparent)" }}
          />

          <ul className="space-y-5">
            {sessions.map((s, i) => (
              <li
                key={s.sessionId}
                className="relative pl-12 sm:pl-16 animate-fade-up"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {/* Timeline node */}
                <span
                  className="absolute left-2.5 sm:left-4.5 top-6 h-3 w-3"
                  style={{ background: "var(--ib-amber)", border: "2px solid var(--ib-bg)" }}
                />

                <div
                  className="ib-card p-5"
                  style={{ borderLeft: "3px solid var(--ib-amber)" }}
                >
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="ib-label inline-flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {new Date(s.date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="ib-label inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> {s.durationFormatted}
                    </span>
                    {s.myReport && (
                      <span className="ib-label inline-flex items-center gap-1.5">
                        <MessageCircle className="h-3 w-3" /> {s.myReport.turns} turns
                      </span>
                    )}
                    <span className="ib-chip">{s.type}</span>
                  </div>

                  <h3 className="text-base font-medium leading-snug mb-4" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif" }}>
                    {s.topic}
                  </h3>

                  {s.myReport && (
                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <div className="font-display text-3xl gradient-text">
                          {s.myReport.overallScore.toFixed(1)}
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
                          Overall
                        </div>
                      </div>
                      {/* Mini bar chart */}
                      <div className="flex gap-0.5 items-end h-8">
                        {Array.from({ length: 10 }).map((_, idx) => (
                          <span
                            key={idx}
                            className="w-1.5"
                            style={{
                              height: `${(idx + 1) * 10}%`,
                              background: idx < Math.round(s.myReport!.overallScore) ? "var(--ib-amber)" : "var(--ib-bdr)",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Peer scores */}
                  {s.myReport && (s.myReport.peerScore != null || s.myReport.combinedScore != null) && (
                    <div className="flex flex-wrap gap-3 mb-4">
                      {s.myReport.peerScore != null && (
                        <div className="text-center">
                          <div className="font-display text-lg" style={{ color: "var(--ib-purple)" }}>{s.myReport.peerScore.toFixed(1)}</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>Peer</div>
                        </div>
                      )}
                      {s.myReport.combinedScore != null && (
                        <div className="text-center">
                          <div className="font-display text-lg gradient-text">{s.myReport.combinedScore.toFixed(1)}</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>Combined</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/report/$sessionId"
                      params={{ sessionId: s.sessionId }}
                      className="btn-primary"
                      style={{ padding: "0.4rem 1rem", fontSize: "0.6rem" }}
                    >
                      View report
                    </Link>
                    <button
                      className="btn-ghost"
                      style={{ padding: "0.4rem 1rem", fontSize: "0.6rem" }}
                      onClick={() => {
                        const style = document.createElement("style");
                        style.textContent = `@media print { nav, aside, button { display: none !important; } }`;
                        document.head.appendChild(style);
                        window.print();
                        setTimeout(() => style.remove(), 1000);
                      }}
                    >
                      <Download className="h-3 w-3" /> PDF
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
