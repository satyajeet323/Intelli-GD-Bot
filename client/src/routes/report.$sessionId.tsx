import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Share2, ArrowLeft, Sparkles, Trophy, MessageCircle, Clock, Loader2, AlertCircle, Users, Quote } from "lucide-react";
import { history, peerRatings, type PeerParticipantSummary, type PeerAggregate } from "@/lib/api";

export const Route = createFileRoute("/report/$sessionId")({
  head: () => ({
    meta: [
      { title: "Session Report — GD Bot" },
      { name: "description", content: "Detailed performance breakdown for your group discussion." },
    ],
  }),
  component: ReportPage,
});

type SessionDetail = {
  sessionId:         string;
  type:              string;
  topic:             string;
  topicSource:       string;
  status:            string;
  date:              string;
  endedAt:           string | null;
  duration:          number;
  durationFormatted: string;
  participantCount:  number;
  participants: Array<{
    userId:   string;
    name:     string;
    isMe:     boolean;
    joinedAt: string;
    report: {
      fluency:       number;
      relevance:     number;
      confidence:    number;
      fillerWords:   number;
      turns:         number;
      overallScore:  number;
      feedback:      string;
      aiFeedback:    string;
      peerScore:     number | null;
      combinedScore: number | null;
      peerFeedback:  string;
    };
  }>;
  leaderboard: Array<{
    rank:         number;
    userId?:      string;
    name:         string;
    isMe:         boolean;
    overallScore: number;
  }>;
};

function ReportPage() {
  const { sessionId } = Route.useParams();
  const [session,     setSession]     = useState<SessionDetail | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [peerSummary, setPeerSummary] = useState<PeerParticipantSummary[] | null>(null);
  const [myPeerData,  setMyPeerData]  = useState<{
    count: number;
    aggregate: PeerAggregate | null;
    peerScore: number | null;
    peerFeedback: string;
    combinedScore: number | null;
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
      if (peerRes.status === "fulfilled") {
        setPeerSummary(peerRes.value.participants);
      }
      if (mineRes.status === "fulfilled") {
        setMyPeerData(mineRes.value.received);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading report…</span>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="px-4 sm:px-8 py-16 max-w-2xl mx-auto text-center">
        <AlertCircle className="h-10 w-10 mx-auto mb-4 text-destructive opacity-70" />
        <p className="text-destructive text-sm mb-4">{error || "Session not found."}</p>
        <Link to="/history" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to history
        </Link>
      </div>
    );
  }

  // Find the current user's own report
  const me = session.participants.find((p) => p.isMe);
  const myReport = me?.report;

  // Parse structured AI report from aiFeedback if it's JSON (AI session)
  let structuredAiReport: {
    overall_score?: number;
    summary: string;
    fluency_analysis?: string;
    grammar_feedback?: string;
    pronunciation_analysis?: string;
    confidence_evaluation?: string;
    relevance_assessment?: string;
    filler_word_analysis?: string;
    vocabulary_assessment?: string;
    strengths: string[];
    weaknesses: string[];
    improvement_suggestions?: string[];
    tips?: string[];
    overall_grade: string;
    grade_justification?: string;
  } | null = null;
  if (myReport?.aiFeedback) {
    try {
      const parsed = JSON.parse(myReport.aiFeedback);
      if (parsed.summary) structuredAiReport = parsed;
    } catch { /* plain text feedback */ }
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-5xl mx-auto space-y-6 animate-fade-in">

      {/* Back link */}
      <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to history
      </Link>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl glass-strong p-8">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl animate-float" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-cyan/25 blur-3xl animate-float" style={{ animationDelay: "2s" }} />
        <div className="relative grid sm:grid-cols-[1fr,auto] gap-6 items-center">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Session Report</p>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold leading-tight">{session.topic}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> {session.durationFormatted}
              </span>
              {myReport && (
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-3 w-3" /> {myReport.turns} turns
                </span>
              )}
              <span>{new Date(session.date).toLocaleDateString(undefined, { dateStyle: "long" })}</span>
              <span className="capitalize px-2 py-0.5 rounded-full bg-background/40 border border-border/50 text-[11px]">
                {session.type}
              </span>
            </div>
          </div>
          {myReport && (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/30 px-8 py-5 shadow-glow">
              <Trophy className="h-5 w-5 text-accent mb-1" />
              <div className="font-display text-5xl font-bold gradient-text">
                {(myReport.combinedScore ?? myPeerData?.combinedScore ?? myReport.overallScore).toFixed(1)}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Overall</div>
            </div>
          )}
        </div>
        <div className="relative mt-6 flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg gradient-cosmic px-4 py-2 text-sm font-semibold text-white shadow-glow hover:opacity-90 transition"
            onClick={() => {
              const style = document.createElement("style");
              style.id = "__print_style";
              style.textContent = `@media print { nav, aside, button, .no-print { display: none !important; } .glass, .glass-strong { background: white !important; border: 1px solid #ddd !important; box-shadow: none !important; } * { color: black !important; } }`;
              document.head.appendChild(style);
              window.print();
              setTimeout(() => document.getElementById("__print_style")?.remove(), 1000);
            }}
          >
            <Download className="h-4 w-4" /> Download PDF
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg glass px-4 py-2 text-sm hover:shadow-glow transition"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>
      </section>

      {myReport ? (
        <>
          {/* AI / auto feedback */}
          {(structuredAiReport || myReport.feedback || myReport.aiFeedback) && (
            <section className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg gradient-cosmic grid place-items-center shadow-glow">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-display font-semibold">AI feedback</h3>
                {structuredAiReport?.overall_grade && (
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                    {structuredAiReport.overall_grade.split(" ")[0]}
                  </span>
                )}
              </div>

              {structuredAiReport ? (
                <div className="space-y-5">
                  {/* Summary */}
                  <p className="text-sm leading-relaxed">{structuredAiReport.summary}</p>

                  {/* Overall score from mentor */}
                  {structuredAiReport.overall_score != null && (
                    <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-primary/15 to-accent/10 border border-primary/25 px-4 py-3">
                      <div className="font-display text-3xl font-bold gradient-text">
                        {structuredAiReport.overall_score.toFixed(1)}
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Communication score</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {structuredAiReport.grade_justification ?? structuredAiReport.overall_grade}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detailed analysis sections */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {structuredAiReport.fluency_analysis && (
                      <AnalysisCard icon="🗣️" label="Fluency" text={structuredAiReport.fluency_analysis} />
                    )}
                    {structuredAiReport.grammar_feedback && (
                      <AnalysisCard icon="✏️" label="Grammar" text={structuredAiReport.grammar_feedback} />
                    )}
                    {structuredAiReport.pronunciation_analysis && (
                      <AnalysisCard icon="🎵" label="Pronunciation" text={structuredAiReport.pronunciation_analysis} />
                    )}
                    {structuredAiReport.confidence_evaluation && (
                      <AnalysisCard icon="💪" label="Confidence" text={structuredAiReport.confidence_evaluation} />
                    )}
                    {structuredAiReport.relevance_assessment && (
                      <AnalysisCard icon="🎯" label="Topic relevance" text={structuredAiReport.relevance_assessment} />
                    )}
                    {structuredAiReport.filler_word_analysis && (
                      <AnalysisCard icon="🔇" label="Filler words" text={structuredAiReport.filler_word_analysis} />
                    )}
                    {structuredAiReport.vocabulary_assessment && (
                      <AnalysisCard icon="📚" label="Vocabulary" text={structuredAiReport.vocabulary_assessment} />
                    )}
                  </div>

                  {/* Strengths + Weaknesses */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-success/10 border border-success/20 p-4">
                      <div className="text-[10px] uppercase tracking-widest text-success mb-2">Strengths</div>
                      <ul className="space-y-1.5">
                        {structuredAiReport.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
                      <div className="text-[10px] uppercase tracking-widest text-destructive mb-2">Areas to improve</div>
                      <ul className="space-y-1.5">
                        {structuredAiReport.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Improvement suggestions / tips */}
                  {(structuredAiReport.improvement_suggestions ?? structuredAiReport.tips ?? []).length > 0 && (
                    <div className="rounded-xl bg-warning/10 border border-warning/20 p-4">
                      <div className="text-[10px] uppercase tracking-widest text-warning mb-3">Improvement suggestions</div>
                      <ol className="space-y-2">
                        {(structuredAiReport.improvement_suggestions ?? structuredAiReport.tips ?? []).map((tip, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning text-[10px] font-bold">
                              {i + 1}
                            </span>
                            {tip}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {structuredAiReport.overall_grade && (
                    <p className="text-xs text-muted-foreground italic">
                      Grade: <span className="font-semibold text-foreground">{structuredAiReport.overall_grade}</span>
                      {structuredAiReport.grade_justification && ` — ${structuredAiReport.grade_justification}`}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 text-sm leading-relaxed">
                  {myReport.aiFeedback && <p>{myReport.aiFeedback}</p>}
                  {myReport.feedback && (
                    <p className="text-muted-foreground">
                      <span className="text-foreground font-medium">Performance summary: </span>
                      {myReport.feedback}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Stats summary */}
          <section className="glass rounded-2xl p-6">
            <h3 className="font-display font-semibold mb-4">Turn statistics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Turns taken"   value={String(myReport.turns)} />
              <StatCard label="Filler words"  value={String(myReport.fillerWords)} />
              <StatCard label="Participants"  value={String(session.participantCount)} />
              <StatCard label="Duration"      value={session.durationFormatted} />
            </div>
          </section>

          {/* Peer rating results — my received ratings */}
          {(myReport.peerScore != null || (myPeerData && myPeerData.count > 0)) && (
            <section className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan/40 to-accent/30 grid place-items-center shadow-glow-cyan">
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="font-display font-semibold">Peer evaluation</h3>
                {myPeerData && (
                  <span className="text-xs text-muted-foreground ml-1">
                    {myPeerData.count} rating{myPeerData.count !== 1 ? "s" : ""} received
                  </span>
                )}
              </div>

              {/* Score cards */}
              <div className="flex flex-wrap justify-center gap-4 mb-5">
                {(myReport.peerScore ?? myPeerData?.peerScore) != null && (
                  <div className="flex-1 min-w-[140px] max-w-[200px] rounded-xl bg-gradient-to-br from-cyan/20 to-accent/10 border border-cyan/30 px-4 py-3 text-center">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Peer score</div>
                    <div className="font-display text-3xl font-bold mt-1" style={{ color: "oklch(0.72 0.2 205)" }}>
                      {(myReport.peerScore ?? myPeerData?.peerScore ?? 0).toFixed(1)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">/10</div>
                  </div>
                )}
                {(myReport.combinedScore ?? myPeerData?.combinedScore) != null && (
                  <div className="flex-1 min-w-[140px] max-w-[200px] rounded-xl bg-gradient-to-br from-success/20 to-cyan/10 border border-success/30 px-4 py-3 text-center">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Combined</div>
                    <div className="font-display text-3xl font-bold mt-1" style={{ color: "oklch(0.72 0.2 145)" }}>
                      {(myReport.combinedScore ?? myPeerData?.combinedScore ?? 0).toFixed(1)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">60% AI · 40% peer</div>
                  </div>
                )}
              </div>

              {/* Criterion breakdown */}
              {myPeerData?.aggregate && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {(["communication", "relevance", "confidence", "clarity"] as const).map((key) => (
                    <div key={key} className="rounded-xl bg-background/40 border border-border/50 px-3 py-2 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground capitalize">{key}</div>
                      <div className="font-display text-lg font-bold mt-0.5">
                        {myPeerData.aggregate![key].toFixed(1)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">/10</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Auto-generated peer feedback text */}
              {(myReport.peerFeedback || myPeerData?.peerFeedback) && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  <span className="text-foreground font-medium">Peer feedback: </span>
                  {myReport.peerFeedback || myPeerData?.peerFeedback}
                </p>
              )}

              {/* Actual written comments from peers */}
              {myPeerData?.aggregate?.comments && myPeerData.aggregate.comments.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Quote className="h-3 w-3" /> Peer comments
                  </div>
                  {myPeerData.aggregate.comments.map((comment, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-background/30 border border-border/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground italic"
                    >
                      "{comment}"
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          No performance data recorded for this session.
        </div>
      )}

      {/* Leaderboard (group sessions) */}
      {session.type === "group" && session.leaderboard.length > 0 && (
        <section className="glass rounded-2xl p-6">
          <h3 className="font-display font-semibold mb-4">Session leaderboard</h3>
          <div className="space-y-2">
            {session.leaderboard.map((p) => (
              <div
                key={p.userId ?? p.name}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 ${p.isMe ? "bg-gradient-to-r from-primary/20 to-accent/10 border border-primary/30" : "bg-background/30 border border-border/40"}`}
              >
                <span className="font-display text-lg font-bold w-6 text-center text-muted-foreground">
                  {p.rank}
                </span>
                <span className="flex-1 font-medium text-sm">
                  {p.name} {p.isMe && <span className="text-xs text-accent ml-1">(you)</span>}
                </span>
                <span className="font-display font-bold gradient-text">{p.overallScore.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Peer rating leaderboard — combined scores */}
      {session.type === "group" && peerSummary && peerSummary.some((p) => p.combinedScore != null) && (
        <section className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan/40 to-accent/30 grid place-items-center">
              <Users className="h-4 w-4" />
            </div>
            <h3 className="font-display font-semibold">Combined leaderboard</h3>
            <span className="text-xs text-muted-foreground ml-1">AI + peer scores</span>
          </div>
          <div className="space-y-2">
            {peerSummary.map((p, i) => (
              <div
                key={p.userId}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 ${p.isMe ? "bg-gradient-to-r from-cyan/20 to-accent/10 border border-cyan/30" : "bg-background/30 border border-border/40"}`}
              >
                <span className="font-display text-lg font-bold w-6 text-center text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 font-medium text-sm">
                  {p.name} {p.isMe && <span className="text-xs text-accent ml-1">(you)</span>}
                </span>
                <div className="text-right">
                  {p.combinedScore != null && (
                    <div className="font-display font-bold text-sm" style={{ color: "oklch(0.72 0.2 205)" }}>
                      {p.combinedScore.toFixed(1)}
                    </div>
                  )}
                  {p.peerScore != null && (
                    <div className="text-[10px] text-muted-foreground">
                      peer {p.peerScore.toFixed(1)} · {p.raterCount} rater{p.raterCount !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AnalysisCard({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div className="rounded-xl bg-background/40 border border-border/50 px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">{icon}</span>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/40 border border-border/50 px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}
