import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Download, Share2, ArrowLeft, Sparkles, Trophy, MessageCircle, Clock, Loader2, AlertCircle, Users, Quote } from "lucide-react";
import { history, peerRatings, type PeerParticipantSummary, type PeerAggregate } from "@/lib/api";

export const Route = createFileRoute("/report/$sessionId")({
  head: () => ({
    meta: [
      { title: "Session Report — INTELLI BOT" },
      { name: "description", content: "Detailed performance breakdown for your group discussion." },
    ],
  }),
  component: ReportPage,
});

type SessionDetail = {
  sessionId: string; type: string; topic: string; topicSource: string;
  status: string; date: string; endedAt: string | null; duration: number;
  durationFormatted: string; participantCount: number;
  participants: Array<{
    userId: string; name: string; isMe: boolean; joinedAt: string;
    report: {
      fluency: number; relevance: number; confidence: number;
      fillerWords: number; turns: number; overallScore: number;
      feedback: string; aiFeedback: string; peerScore: number | null;
      combinedScore: number | null; peerFeedback: string;
    };
  }>;
  leaderboard: Array<{ rank: number; userId?: string; name: string; isMe: boolean; overallScore: number }>;
};

/* ── Animated score bar ─────────────────────────────────────────────────── */
function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-mut2)" }}>
          {label}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.7rem", color: "var(--ib-amber)", fontWeight: 700 }}>
          {value.toFixed(1)}
        </span>
      </div>
      <div className="ib-bar">
        <div className="ib-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Circular gauge ─────────────────────────────────────────────────────── */
function CircularGauge({ score, max = 10 }: { score: number; max?: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / max, 1);
  const dash = pct * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--ib-bdr)" strokeWidth="8" />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke="url(#amberGrad)" strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="butt"
          transform="rotate(-90 65 65)"
          style={{ transition: "stroke-dasharray 1s cubic-bezier(0.16,1,0.3,1)" }}
        />
        <defs>
          <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <text x="65" y="60" textAnchor="middle" style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "28px", fill: "var(--ib-fg)", letterSpacing: "0.05em" }}>
          {score.toFixed(1)}
        </text>
        <text x="65" y="78" textAnchor="middle" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", fill: "var(--ib-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          OVERALL
        </text>
      </svg>
    </div>
  );
}

/* ── Typewriter ─────────────────────────────────────────────────────────── */
function Typewriter({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(id);
    }, 12);
    return () => clearInterval(id);
  }, [text]);
  return <span>{displayed}</span>;
}

function ReportPage() {
  const { sessionId } = Route.useParams();
  const [session,     setSession]     = useState<SessionDetail | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [peerSummary, setPeerSummary] = useState<PeerParticipantSummary[] | null>(null);
  const [myPeerData,  setMyPeerData]  = useState<{
    count: number; aggregate: PeerAggregate | null;
    peerScore: number | null; peerFeedback: string; combinedScore: number | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      history.get(sessionId),
      peerRatings.summary(sessionId),
      peerRatings.mine(sessionId),
    ]).then(([histRes, peerRes, mineRes]) => {
      if (cancelled) return;
      if (histRes.status === "fulfilled") {
        setSession((histRes.value as { success: boolean; session: SessionDetail }).session);
      } else {
        setError((histRes.reason as Error).message ?? "Failed to load report.");
      }
      if (peerRes.status === "fulfilled") setPeerSummary(peerRes.value.participants);
      if (mineRes.status === "fulfilled") setMyPeerData(mineRes.value.received);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3" style={{ color: "var(--ib-mut2)" }}>
        <Loader2 className="h-6 w-6 animate-spin" />
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.75rem", letterSpacing: "0.1em" }}>Loading report…</span>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="px-4 sm:px-8 py-16 max-w-2xl mx-auto text-center">
        <AlertCircle className="h-10 w-10 mx-auto mb-4" style={{ color: "var(--ib-terra)" }} />
        <p className="text-sm mb-4" style={{ color: "var(--ib-terra)" }}>{error || "Session not found."}</p>
        <Link to="/history" className="btn-ghost inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to history
        </Link>
      </div>
    );
  }

  const me = session.participants.find((p) => p.isMe);
  const myReport = me?.report;

  let structuredAiReport: {
    overall_score?: number; summary: string; fluency_analysis?: string;
    grammar_feedback?: string; pronunciation_analysis?: string;
    confidence_evaluation?: string; relevance_assessment?: string;
    filler_word_analysis?: string; vocabulary_assessment?: string;
    strengths: string[]; weaknesses: string[];
    improvement_suggestions?: string[]; tips?: string[];
    overall_grade: string; grade_justification?: string;
  } | null = null;
  if (myReport?.aiFeedback) {
    try {
      const parsed = JSON.parse(myReport.aiFeedback);
      if (parsed.summary) structuredAiReport = parsed;
    } catch { /* plain text */ }
  }

  const combinedScore = myReport?.combinedScore ?? myPeerData?.combinedScore ?? myReport?.overallScore ?? 0;

  return (
    <div className="px-4 sm:px-8 py-8 pb-20 max-w-5xl mx-auto space-y-6 animate-fade-in" style={{ background: "var(--ib-bg)" }}>

      <Link to="/history" className="inline-flex items-center gap-1.5 transition-colors" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
        <ArrowLeft className="h-4 w-4" /> Back to history
      </Link>

      {/* Hero */}
      <section
        className="relative overflow-hidden scanlines p-8"
        style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)", borderLeft: "3px solid var(--ib-amber)" }}
      >
        <div className="ib-grid-bg" />
        <div className="relative z-10 grid sm:grid-cols-[1fr,auto] gap-6 items-center">
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ib-amber)", marginBottom: "0.5rem" }}>
              Session Report
            </div>
            <h1 className="font-display text-2xl sm:text-3xl" style={{ color: "var(--ib-fg)" }}>{session.topic}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="ib-label inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> {session.durationFormatted}
              </span>
              {myReport && (
                <span className="ib-label inline-flex items-center gap-1.5">
                  <MessageCircle className="h-3 w-3" /> {myReport.turns} turns
                </span>
              )}
              <span className="ib-label">{new Date(session.date).toLocaleDateString(undefined, { dateStyle: "long" })}</span>
              <span className="ib-chip">{session.type}</span>
            </div>
          </div>
          {myReport && <CircularGauge score={combinedScore} />}
        </div>

        {/* Score bars */}
        {myReport && (
          <div className="relative z-10 mt-6 space-y-3 max-w-lg">
            <ScoreBar label="Fluency"    value={myReport.fluency} />
            <ScoreBar label="Relevance"  value={myReport.relevance} />
            <ScoreBar label="Confidence" value={myReport.confidence} />
          </div>
        )}

        <div className="relative z-10 mt-6 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            style={{ padding: "0.5rem 1.25rem", fontSize: "0.65rem" }}
            onClick={() => {
              const style = document.createElement("style");
              style.id = "__print_style";
              style.textContent = `@media print { nav, aside, button { display: none !important; } * { color: black !important; background: white !important; } }`;
              document.head.appendChild(style);
              window.print();
              setTimeout(() => document.getElementById("__print_style")?.remove(), 1000);
            }}
          >
            <Download className="h-4 w-4" /> Download PDF
          </button>
          <button
            className="btn-ghost"
            style={{ padding: "0.5rem 1.25rem", fontSize: "0.65rem" }}
            onClick={() => navigator.clipboard.writeText(window.location.href)}
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>
      </section>

      {myReport ? (
        <>
          {/* AI Feedback */}
          {(structuredAiReport || myReport.feedback || myReport.aiFeedback) && (
            <section className="p-6 space-y-4" style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 flex items-center justify-center" style={{ background: "var(--ib-amber)", clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)" }}>
                  <Sparkles className="h-4 w-4" style={{ color: "#0c0b09" }} />
                </div>
                <h3 className="font-display text-xl" style={{ color: "var(--ib-fg)" }}>AI Feedback</h3>
                {structuredAiReport?.overall_grade && (
                  <span className="ib-chip ml-auto">{structuredAiReport.overall_grade.split(" ")[0]}</span>
                )}
              </div>

              {structuredAiReport ? (
                <div className="space-y-4">
                  <div className="p-4" style={{ background: "var(--ib-card2)", border: "1px solid var(--ib-bdr)" }}>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
                      <Typewriter text={structuredAiReport.summary} />
                    </p>
                  </div>

                  {structuredAiReport.overall_score != null && (
                    <div className="flex items-center gap-3 p-4" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
                      <div className="font-display text-3xl gradient-text">{structuredAiReport.overall_score.toFixed(1)}</div>
                      <div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-muted)" }}>Communication score</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif" }}>
                          {structuredAiReport.grade_justification ?? structuredAiReport.overall_grade}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { icon: "🗣️", label: "Fluency",       text: structuredAiReport.fluency_analysis },
                      { icon: "✏️", label: "Grammar",       text: structuredAiReport.grammar_feedback },
                      { icon: "🎵", label: "Pronunciation", text: structuredAiReport.pronunciation_analysis },
                      { icon: "💪", label: "Confidence",    text: structuredAiReport.confidence_evaluation },
                      { icon: "🎯", label: "Relevance",     text: structuredAiReport.relevance_assessment },
                      { icon: "🔇", label: "Filler words",  text: structuredAiReport.filler_word_analysis },
                      { icon: "📚", label: "Vocabulary",    text: structuredAiReport.vocabulary_assessment },
                    ].filter((x) => x.text).map((x) => (
                      <div key={x.label} className="p-3" style={{ background: "var(--ib-card2)", border: "1px solid var(--ib-bdr)" }}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-sm">{x.icon}</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ib-muted)" }}>{x.label}</span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif" }}>{x.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4" style={{ background: "rgba(134,239,172,0.06)", border: "1px solid rgba(134,239,172,0.2)" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-ok)", marginBottom: "0.5rem" }}>Strengths</div>
                      <ul className="space-y-1.5">
                        {structuredAiReport.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--ib-ok)" }} />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-4" style={{ background: "rgba(220,138,107,0.06)", border: "1px solid rgba(220,138,107,0.2)" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-terra)", marginBottom: "0.5rem" }}>Areas to improve</div>
                      <ul className="space-y-1.5">
                        {structuredAiReport.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--ib-terra)" }} />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {(structuredAiReport.improvement_suggestions ?? structuredAiReport.tips ?? []).length > 0 && (
                    <div className="p-4" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-gold)", marginBottom: "0.75rem" }}>Improvement suggestions</div>
                      <ol className="space-y-2">
                        {(structuredAiReport.improvement_suggestions ?? structuredAiReport.tips ?? []).map((tip, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-bold" style={{ background: "rgba(245,158,11,0.15)", color: "var(--ib-amber)", fontFamily: "'JetBrains Mono',monospace" }}>
                              {i + 1}
                            </span>
                            {tip}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
                  {myReport.aiFeedback && <p>{myReport.aiFeedback}</p>}
                  {myReport.feedback && <p style={{ color: "var(--ib-mut2)" }}>{myReport.feedback}</p>}
                </div>
              )}
            </section>
          )}

          {/* Stats */}
          <section className="p-6" style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}>
            <h3 className="font-display text-xl mb-4" style={{ color: "var(--ib-fg)" }}>Turn Statistics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Turns taken",  value: String(myReport.turns) },
                { label: "Filler words", value: String(myReport.fillerWords) },
                { label: "Participants", value: String(session.participantCount) },
                { label: "Duration",     value: session.durationFormatted },
              ].map((s) => (
                <div key={s.label} className="p-4" style={{ background: "var(--ib-card2)", border: "1px solid var(--ib-bdr)", borderBottom: "2px solid var(--ib-amber)" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ib-muted)" }}>{s.label}</div>
                  <div className="font-display text-xl mt-1" style={{ color: "var(--ib-fg)" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Peer evaluation */}
          {(myReport.peerScore != null || (myPeerData && myPeerData.count > 0)) && (
            <section className="p-6" style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 flex items-center justify-center" style={{ background: "rgba(192,132,252,0.15)", border: "1px solid rgba(192,132,252,0.3)" }}>
                  <Users className="h-4 w-4" style={{ color: "var(--ib-purple)" }} />
                </div>
                <h3 className="font-display text-xl" style={{ color: "var(--ib-fg)" }}>Peer Evaluation</h3>
                {myPeerData && (
                  <span className="ib-chip-purple ml-1">{myPeerData.count} rating{myPeerData.count !== 1 ? "s" : ""}</span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {(["communication", "relevance", "confidence", "clarity"] as const).map((key) => (
                  myPeerData?.aggregate && (
                    <div key={key} className="p-3 text-center" style={{ background: "var(--ib-card2)", border: "1px solid var(--ib-bdr)" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ib-muted)" }}>{key}</div>
                      <div className="font-display text-xl mt-1" style={{ color: "var(--ib-purple)" }}>{myPeerData.aggregate![key].toFixed(1)}</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", color: "var(--ib-muted)" }}>/10</div>
                    </div>
                  )
                ))}
              </div>

              {(myReport.peerFeedback || myPeerData?.peerFeedback) && (
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
                  {myReport.peerFeedback || myPeerData?.peerFeedback}
                </p>
              )}

              {myPeerData?.aggregate?.comments && myPeerData.aggregate.comments.length > 0 && (
                <div className="space-y-3">
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Quote className="h-3 w-3" /> Peer comments
                  </div>
                  {myPeerData.aggregate.comments.map((comment, i) => (
                    <div key={i} className="px-4 py-3 text-sm leading-relaxed italic" style={{ background: "var(--ib-card2)", border: "1px solid var(--ib-bdr)", color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
                      "{comment}"
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <div className="p-8 text-center text-sm" style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)", color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif" }}>
          No performance data recorded for this session.
        </div>
      )}

      {/* Leaderboard */}
      {session.type === "group" && session.leaderboard.length > 0 && (
        <section className="p-6" style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}>
          <h3 className="font-display text-xl mb-4" style={{ color: "var(--ib-fg)" }}>Session Leaderboard</h3>
          <div className="space-y-2">
            {session.leaderboard.map((p) => (
              <div
                key={p.userId ?? p.name}
                className="flex items-center gap-4 px-4 py-3"
                style={{
                  background: p.isMe ? "rgba(245,158,11,0.08)" : "var(--ib-card2)",
                  border: `1px solid ${p.isMe ? "rgba(245,158,11,0.3)" : "var(--ib-bdr)"}`,
                  borderLeft: p.isMe ? "3px solid var(--ib-amber)" : "3px solid transparent",
                }}
              >
                <span className="font-display text-lg w-6 text-center" style={{ color: "var(--ib-muted)" }}>{p.rank}</span>
                <span className="flex-1 text-sm" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif" }}>
                  {p.name} {p.isMe && <span className="ib-chip ml-1">you</span>}
                </span>
                <span className="font-display gradient-text">{p.overallScore.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
