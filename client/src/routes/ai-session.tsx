import { createFileRoute } from "@tanstack/react-router";
import { useAISession } from "@/lib/useAISession";
import { downloadReport } from "@/lib/generateAISessionReport";
import {
  Mic,
  MicOff,
  Square,
  Play,
  Download,
  Sparkles,
  Volume2,
  VolumeX,
  RefreshCw,
  MessageSquare,
  Clock,
  RotateCcw,
} from "lucide-react";
import { useRef, useEffect } from "react";

export const Route = createFileRoute("/ai-session")({
  head: () => ({
    meta: [
      { title: "AI Session — GD Bot" },
      { name: "description", content: "Real-time speech-to-speech AI discussion partner." },
    ],
  }),
  component: AISessionPage,
});

// ── Timer formatter ───────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Phase indicator ───────────────────────────────────────────────────────────
function PhaseIndicator({ phase }: { phase: string }) {
  const config: Record<string, { label: string; color: string; pulse: boolean }> = {
    idle:       { label: "Ready",      color: "bg-muted-foreground", pulse: false },
    starting:   { label: "Starting…",  color: "bg-warning",          pulse: true  },
    listening:  { label: "Listening",  color: "bg-success",          pulse: true  },
    processing: { label: "Thinking…",  color: "bg-primary",          pulse: true  },
    speaking:   { label: "AI Speaking",color: "bg-accent",           pulse: true  },
    ended:      { label: "Ended",      color: "bg-muted-foreground", pulse: false },
  };
  const { label, color, pulse } = config[phase] ?? config.idle;
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color} ${pulse ? "animate-pulse" : ""}`} />
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  role,
  content,
  ts,
}: {
  role: "user" | "assistant";
  content: string;
  ts: number;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-fade-up`}>
      <div className="flex items-center gap-1.5 mb-1">
        {!isUser && <Sparkles className="h-3 w-3 text-primary" />}
        <span className="text-[10px] text-muted-foreground">
          {isUser ? "You" : "AI"} · {new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div
        className={[
          "max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "glass border border-white/10 rounded-bl-sm",
        ].join(" ")}
      >
        {content}
      </div>
    </div>
  );
}

// ── Score card ────────────────────────────────────────────────────────────────
function ScoreCard({ label, value }: { label: string; value: number }) {
  const color =
    value >= 8 ? "text-success" : value >= 6 ? "text-warning" : "text-destructive";
  return (
    <div className="glass border border-white/8 rounded-xl p-4 text-center">
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}/10</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function AISessionPage() {
  const {
    phase,
    topic,
    messages,
    liveTranscript,
    elapsedSeconds,
    report,
    error,
    isTTSAvailable,
    startSession,
    endSession,
    toggleListening,
  } = useAISession();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript]);

  const isActive = phase !== "idle" && phase !== "ended";
  const isEnded = phase === "ended";

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in">

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-border/50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">AI Session</h1>
            <p className="text-xs text-muted-foreground">Speech-to-speech discussion partner</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* TTS status */}
          {isActive && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              {isTTSAvailable
                ? <Volume2 className="h-3.5 w-3.5 text-success" />
                : <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />}
              <span>{isTTSAvailable ? "Voice on" : "Voice off"}</span>
            </div>
          )}

          {/* Timer */}
          {isActive && (
            <div className="flex items-center gap-1.5 glass border border-white/10 rounded-lg px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-sm font-semibold tabular-nums">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
          )}

          <PhaseIndicator phase={phase} />
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-6 space-y-6">

        {/* ── IDLE state ─────────────────────────────────────────────────── */}
        {phase === "idle" && !isEnded && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping" />
            </div>

            <div className="space-y-3 max-w-md">
              <h2 className="text-2xl font-bold font-display">Start an AI Discussion</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                A topic will be generated automatically. Speak naturally — the AI will respond
                with voice and continue the discussion with you.
              </p>
            </div>

            {error && (
              <div className="glass border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive max-w-md">
                {error}
              </div>
            )}

            <button
              onClick={() => startSession()}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_-8px_oklch(0.97_0_0/0.4)]"
            >
              <Play className="h-4.5 w-4.5" />
              Start AI Session
            </button>
          </div>
        )}

        {/* ── STARTING state ─────────────────────────────────────────────── */}
        {phase === "starting" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="h-16 w-16 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-muted-foreground text-sm">Generating topic and opening the discussion…</p>
          </div>
        )}

        {/* ── ACTIVE / ENDED: Topic + conversation ───────────────────────── */}
        {(isActive || isEnded) && topic && (
          <>
            {/* Topic card */}
            <div className="glass border border-primary/20 rounded-2xl p-5 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-start gap-3">
                <MessageSquare className="h-4.5 w-4.5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    Discussion Topic
                  </p>
                  <p className="font-semibold text-sm leading-relaxed">{topic}</p>
                </div>
              </div>
            </div>

            {/* Conversation */}
            <div className="space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} role={msg.role} content={msg.content} ts={msg.ts} />
              ))}

              {/* Live transcript preview */}
              {liveTranscript && phase === "listening" && (
                <div className="flex flex-col items-end animate-fade-up">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Mic className="h-3 w-3 text-success animate-pulse" />
                    <span className="text-[10px] text-muted-foreground">You (live)</span>
                  </div>
                  <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed bg-primary/20 border border-primary/30 text-foreground/80 italic">
                    {liveTranscript}
                  </div>
                </div>
              )}

              {/* AI thinking indicator */}
              {phase === "processing" && (
                <div className="flex flex-col items-start animate-fade-up">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-[10px] text-muted-foreground">AI</span>
                  </div>
                  <div className="glass border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* AI speaking indicator */}
              {phase === "speaking" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
                  <Volume2 className="h-3.5 w-3.5 text-accent animate-pulse" />
                  <span>AI is speaking…</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </>
        )}

        {/* ── REPORT section ─────────────────────────────────────────────── */}
        {isEnded && report && (
          <div className="space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Session Report</h2>
              <button
                onClick={() => downloadReport(report)}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg glass border border-white/10 hover:border-white/20 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Download HTML
              </button>
            </div>

            {/* Score grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ScoreCard label="Overall" value={report.analysis.overallScore} />
              <ScoreCard label="Vocabulary" value={report.analysis.vocabularyScore} />
              <ScoreCard label="Clarity" value={report.analysis.clarityScore} />
              <ScoreCard label="Engagement" value={report.analysis.engagementScore} />
            </div>

            {/* Summary */}
            <div className="glass border border-white/8 rounded-xl p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Summary</p>
              <p className="text-sm leading-relaxed text-foreground/90">{report.analysis.summary}</p>
            </div>

            {/* Communication feedback */}
            <div className="glass border border-white/8 rounded-xl p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Communication Feedback</p>
              <p className="text-sm leading-relaxed text-foreground/90">{report.analysis.communicationFeedback}</p>
            </div>

            {/* Contextual relevance */}
            <div className="glass border border-white/8 rounded-xl p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Contextual Relevance</p>
              <p className="text-sm leading-relaxed text-foreground/90">{report.analysis.contextualRelevance}</p>
            </div>

            {/* Strengths */}
            <div className="glass border border-white/8 rounded-xl p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Strengths</p>
              <div className="flex flex-wrap gap-2">
                {report.analysis.strengths.map((s, i) => (
                  <span key={i} className="text-xs px-3 py-1 rounded-full bg-success/10 border border-success/20 text-success">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Weaknesses */}
            <div className="glass border border-white/8 rounded-xl p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Areas to Improve</p>
              <div className="flex flex-wrap gap-2">
                {report.analysis.weaknesses.map((w, i) => (
                  <span key={i} className="text-xs px-3 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive">
                    {w}
                  </span>
                ))}
              </div>
            </div>

            {/* Grammar suggestions */}
            <div className="glass border border-white/8 rounded-xl p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Grammar & Language</p>
              <ul className="space-y-1.5">
                {report.analysis.grammarSuggestions.map((g, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex gap-2">
                    <span className="text-warning shrink-0">→</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="glass border border-white/8 rounded-xl p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Recommendations</p>
              <ul className="space-y-1.5">
                {report.analysis.improvements.map((imp, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex gap-2">
                    <span className="text-primary shrink-0">✦</span>
                    {imp}
                  </li>
                ))}
              </ul>
            </div>

            {/* Start new session */}
            <div className="flex justify-center pt-4 pb-8">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl glass border border-white/10 hover:border-white/20 text-sm font-medium transition hover:scale-105 active:scale-95"
              >
                <RotateCcw className="h-4 w-4" />
                Start New Session
              </button>
            </div>
          </div>
        )}

        {/* Ended but no report (too short) */}
        {isEnded && !report && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <p className="text-muted-foreground text-sm">Session ended. Start a new one to get a full report.</p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl glass border border-white/10 hover:border-white/20 text-sm font-medium transition"
            >
              <RotateCcw className="h-4 w-4" />
              Start New Session
            </button>
          </div>
        )}
      </div>

      {/* ── Control bar (only when active) ─────────────────────────────────── */}
      {isActive && (
        <div className="shrink-0 border-t border-border/50 bg-background/80 backdrop-blur-xl px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between max-w-lg mx-auto gap-4">

            {/* Mic toggle */}
            <button
              onClick={toggleListening}
              disabled={phase === "processing" || phase === "speaking" || phase === "starting"}
              className={[
                "flex flex-col items-center gap-1.5 rounded-2xl px-5 py-3 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
                phase === "listening"
                  ? "bg-success/20 border border-success/40 text-success shadow-[0_0_20px_-4px_oklch(0.72_0.17_155/0.5)]"
                  : "glass border border-white/10 text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {phase === "listening"
                ? <Mic className="h-5 w-5 animate-pulse" />
                : <MicOff className="h-5 w-5" />}
              <span className="text-[10px] font-medium hidden sm:block">
                {phase === "listening" ? "Listening" : "Speak"}
              </span>
            </button>

            {/* Center: phase info */}
            <div className="flex-1 text-center">
              {phase === "listening" && liveTranscript && (
                <p className="text-xs text-muted-foreground truncate max-w-xs mx-auto italic">
                  "{liveTranscript.slice(0, 80)}{liveTranscript.length > 80 ? "…" : ""}"
                </p>
              )}
              {phase === "processing" && (
                <div className="flex items-center justify-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">AI is thinking…</span>
                </div>
              )}
              {phase === "speaking" && (
                <div className="flex items-center justify-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-accent animate-pulse" />
                  <span className="text-xs text-muted-foreground">AI speaking…</span>
                </div>
              )}
            </div>

            {/* End session */}
            <button
              onClick={endSession}
              className="flex flex-col items-center gap-1.5 rounded-2xl px-5 py-3 bg-destructive/20 hover:bg-destructive/40 border border-destructive/30 text-destructive transition-all hover:scale-105 active:scale-95"
            >
              <Square className="h-5 w-5" />
              <span className="text-[10px] font-medium hidden sm:block">End</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
