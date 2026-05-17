import { createFileRoute } from "@tanstack/react-router";
import { useAISession } from "@/lib/useAISession";
import { downloadReport } from "@/lib/generateAISessionReport";
import {
  Mic, MicOff, Square, Play, Download, Sparkles,
  Volume2, VolumeX, RefreshCw, MessageSquare, Clock, RotateCcw,
} from "lucide-react";
import { useRef, useEffect } from "react";

export const Route = createFileRoute("/ai-session")({
  head: () => ({
    meta: [
      { title: "AI Session — INTELLI BOT" },
      { name: "description", content: "Real-time speech-to-speech AI discussion partner." },
    ],
  }),
  component: AISessionPage,
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* ── Canvas waveform — reads CSS vars so it adapts to light/dark ─────────── */
function WaveformCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let raf: number;
    const draw = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const amp = active ? 22 : 6;
      // Read CSS variable at draw time so theme changes are reflected immediately
      const styles = getComputedStyle(document.documentElement);
      const amberRaw = styles.getPropertyValue("--ib-amber").trim() || "#f59e0b";
      const mutedRaw = styles.getPropertyValue("--ib-muted").trim() || "#5e5a54";
      ctx.strokeStyle = active
        ? amberRaw.startsWith("#") ? amberRaw + "99" : amberRaw   // ~60% opacity
        : mutedRaw.startsWith("#") ? mutedRaw + "66" : mutedRaw;  // ~40% opacity
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const t = (x / canvas.width) * Math.PI * 8 + frame * 0.05;
        const y = canvas.height / 2 + Math.sin(t) * amp + Math.sin(t * 2.1 + 1) * (amp * 0.4);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      frame++;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return <canvas ref={canvasRef} style={{ width: "100%", height: "48px", display: "block" }} />;
}

/* ── Phase indicator ─────────────────────────────────────────────────────── */
function PhaseIndicator({ phase }: { phase: string }) {
  const config: Record<string, { label: string; color: string; pulse: boolean }> = {
    idle:       { label: "Ready",       color: "var(--ib-muted)",  pulse: false },
    starting:   { label: "Starting…",  color: "var(--ib-gold)",   pulse: true  },
    listening:  { label: "Listening",  color: "var(--ib-ok)",     pulse: true  },
    processing: { label: "Thinking…",  color: "var(--ib-amber)",  pulse: true  },
    speaking:   { label: "AI Speaking",color: "var(--ib-purple)", pulse: true  },
    ended:      { label: "Ended",      color: "var(--ib-muted)",  pulse: false },
  };
  const { label, color, pulse } = config[phase] ?? config.idle;
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color, animation: pulse ? "pulse 1.5s infinite" : "none" }}
      />
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-mut2)" }}>
        {label}
      </span>
    </div>
  );
}

/* ── Message bubble ──────────────────────────────────────────────────────── */
function MessageBubble({ role, content, ts }: { role: "user" | "assistant"; content: string; ts: number }) {
  const isUser = role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-fade-up`}>
      <div className="flex items-center gap-1.5 mb-1">
        {!isUser && <Sparkles className="h-3 w-3" style={{ color: "var(--ib-amber)" }} />}
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
          {isUser ? "You >" : "AI >"} · {new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div
        className="max-w-[85%] sm:max-w-[70%] px-4 py-3 text-sm leading-relaxed"
        style={{
          background: isUser ? "var(--ib-amber)" : "var(--ib-card2)",
          color: isUser ? "#0c0b09" : "var(--ib-fg)",
          border: isUser ? "none" : "1px solid var(--ib-bdr)",
          fontFamily: isUser ? "'DM Sans',sans-serif" : "'JetBrains Mono',monospace",
          fontSize: isUser ? "0.875rem" : "0.75rem",
          fontWeight: isUser ? 400 : 400,
          clipPath: isUser
            ? "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)"
            : "polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)",
        }}
      >
        {content}
      </div>
    </div>
  );
}

/* ── Score card ──────────────────────────────────────────────────────────── */
function ScoreCard({ label, value }: { label: string; value: number }) {
  const color = value >= 8 ? "var(--ib-ok)" : value >= 6 ? "var(--ib-gold)" : "var(--ib-terra)";
  return (
    <div className="p-4 text-center" style={{ background: "var(--ib-card2)", border: "1px solid var(--ib-bdr)", borderBottom: "2px solid var(--ib-amber)" }}>
      <div className="font-display text-2xl" style={{ color }}>{value}/10</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)", marginTop: "2px" }}>
        {label}
      </div>
      <div className="ib-bar mt-2">
        <div className="ib-bar-fill" style={{ width: `${(value / 10) * 100}%` }} />
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */
function AISessionPage() {
  const {
    phase, topic, messages, liveTranscript, elapsedSeconds,
    report, error, isTTSAvailable, startSession, endSession, toggleListening,
  } = useAISession();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript]);

  const isActive = phase !== "idle" && phase !== "ended";
  const isEnded  = phase === "ended";

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in" style={{ background: "var(--ib-bg)" }}>

      {/* Header */}
      <div
        className="shrink-0 px-4 sm:px-6 py-4 flex items-center justify-between gap-4"
        style={{ background: "var(--ib-surf)", borderBottom: "1px solid var(--ib-bdr)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 flex items-center justify-center shrink-0"
            style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}
          >
            <Sparkles className="h-4 w-4" style={{ color: "var(--ib-amber)" }} />
          </div>
          <div>
            <h1 className="font-display text-base" style={{ color: "var(--ib-fg)" }}>AI Session</h1>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
              Speech-to-speech discussion partner
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isActive && (
            <div className="hidden sm:flex items-center gap-1.5" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.08em", color: "var(--ib-muted)" }}>
              {isTTSAvailable
                ? <Volume2 className="h-3.5 w-3.5" style={{ color: "var(--ib-ok)" }} />
                : <VolumeX className="h-3.5 w-3.5" />}
              <span>{isTTSAvailable ? "Voice on" : "Voice off"}</span>
            </div>
          )}
          {isActive && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5"
              style={{ border: "1px solid var(--ib-bdr)", background: "var(--ib-card2)" }}
            >
              <Clock className="h-3.5 w-3.5" style={{ color: "var(--ib-muted)" }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.8rem", color: "var(--ib-fg)", fontWeight: 700 }}>
                {formatTime(elapsedSeconds)}
              </span>
            </div>
          )}
          <PhaseIndicator phase={phase} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-6 space-y-6">

        {/* Idle */}
        {phase === "idle" && !isEnded && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
            <div className="relative">
              <div
                className="h-24 w-24 flex items-center justify-center"
                style={{
                  background: "var(--ib-card2)",
                  border: "1px solid var(--ib-amber)",
                  clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)",
                }}
              >
                <Sparkles className="h-10 w-10" style={{ color: "var(--ib-amber)" }} />
              </div>
              <div
                className="absolute inset-0 animate-pulse-glow"
                style={{
                  border: "1px solid var(--ib-amber)",
                  clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)",
                  opacity: 0.4,
                }}
              />
            </div>

            <div className="space-y-3 max-w-md">
              <h2 className="font-display text-3xl" style={{ color: "var(--ib-fg)" }}>Start an AI Discussion</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
                A topic will be generated automatically. Speak naturally — the AI will respond with voice and continue the discussion with you.
              </p>
            </div>

            {error && (
              <div className="px-4 py-3 text-sm max-w-md" style={{ background: "rgba(220,138,107,0.1)", border: "1px solid rgba(220,138,107,0.3)", color: "var(--ib-terra)" }}>
                {error}
              </div>
            )}

            <button onClick={() => startSession()} className="btn-primary" style={{ padding: "1rem 2.5rem", fontSize: "0.8rem" }}>
              <Play className="h-4 w-4" /> Start AI Session
            </button>
          </div>
        )}

        {/* Starting */}
        {phase === "starting" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="h-16 w-16 rounded-full border-2 border-t-amber-400 animate-spin" style={{ borderColor: "var(--ib-bdr)", borderTopColor: "var(--ib-amber)" }} />
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.7rem", letterSpacing: "0.1em", color: "var(--ib-muted)" }}>
              Generating topic and opening the discussion…
            </p>
          </div>
        )}

        {/* Active / Ended */}
        {(isActive || isEnded) && topic && (
          <>
            {/* Topic card */}
            <div className="p-5" style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)", borderLeft: "3px solid var(--ib-amber)" }}>
              <div className="flex items-start gap-3">
                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--ib-amber)" }} />
                <div>
                  <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-muted)", marginBottom: "0.25rem" }}>
                    Discussion Topic
                  </p>
                  <p className="font-semibold text-sm leading-relaxed" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif" }}>{topic}</p>
                </div>
              </div>
            </div>

            {/* Waveform */}
            <div style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)", padding: "0.5rem" }}>
              <WaveformCanvas active={phase === "listening"} />
            </div>

            {/* Conversation */}
            <div className="space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} role={msg.role} content={msg.content} ts={msg.ts} />
              ))}

              {liveTranscript && phase === "listening" && (
                <div className="flex flex-col items-end animate-fade-up">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Mic className="h-3 w-3 animate-pulse" style={{ color: "var(--ib-ok)" }} />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
                      You (live)
                    </span>
                  </div>
                  <div
                    className="max-w-[85%] sm:max-w-[70%] px-4 py-3 text-sm leading-relaxed italic"
                    style={{
                      background: "var(--ib-card2)",
                      border: "1px solid var(--ib-amber)",
                      color: "var(--ib-fg)",
                      fontFamily: "'DM Sans',sans-serif",
                      opacity: 0.85,
                    }}
                  >
                    {liveTranscript}
                  </div>
                </div>
              )}

              {phase === "processing" && (
                <div className="flex flex-col items-start animate-fade-up">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3 w-3" style={{ color: "var(--ib-amber)" }} />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>AI</span>
                  </div>
                  <div className="px-4 py-3" style={{ background: "var(--ib-card2)", border: "1px solid var(--ib-bdr)" }}>
                    <div className="flex gap-1.5 items-center">
                      {[0, 150, 300].map((d) => (
                        <span key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ib-amber)", animation: `bounce 1s ${d}ms infinite` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {phase === "speaking" && (
                <div className="flex items-center gap-2 text-xs animate-fade-in" style={{ color: "var(--ib-muted)" }}>
                  <Volume2 className="h-3.5 w-3.5 animate-pulse" style={{ color: "var(--ib-purple)" }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.1em" }}>AI is speaking…</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </>
        )}

        {/* Report */}
        {isEnded && report && (
          <div className="space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl" style={{ color: "var(--ib-fg)" }}>Session Report</h2>
              <button
                onClick={() => downloadReport(report)}
                className="btn-ghost inline-flex items-center gap-2"
                style={{ padding: "0.4rem 1rem", fontSize: "0.6rem" }}
              >
                <Download className="h-3.5 w-3.5" /> Download HTML
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ScoreCard label="Overall"    value={report.analysis.overallScore} />
              <ScoreCard label="Vocabulary" value={report.analysis.vocabularyScore} />
              <ScoreCard label="Clarity"    value={report.analysis.clarityScore} />
              <ScoreCard label="Engagement" value={report.analysis.engagementScore} />
            </div>

            {[
              { label: "Summary",                text: report.analysis.summary },
              { label: "Communication Feedback", text: report.analysis.communicationFeedback },
              { label: "Contextual Relevance",   text: report.analysis.contextualRelevance },
            ].map((s) => (
              <div key={s.label} className="p-4 space-y-2" style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}>
                <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-muted)" }}>{s.label}</p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>{s.text}</p>
              </div>
            ))}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4" style={{ background: "rgba(134,239,172,0.06)", border: "1px solid rgba(134,239,172,0.2)" }}>
                <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-ok)", marginBottom: "0.5rem" }}>Strengths</p>
                <div className="flex flex-wrap gap-2">
                  {report.analysis.strengths.map((s, i) => (
                    <span key={i} className="ib-chip" style={{ background: "rgba(134,239,172,0.1)", color: "var(--ib-ok)", borderColor: "rgba(134,239,172,0.3)" }}>{s}</span>
                  ))}
                </div>
              </div>
              <div className="p-4" style={{ background: "rgba(220,138,107,0.06)", border: "1px solid rgba(220,138,107,0.2)" }}>
                <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-terra)", marginBottom: "0.5rem" }}>Areas to Improve</p>
                <div className="flex flex-wrap gap-2">
                  {report.analysis.weaknesses.map((w, i) => (
                    <span key={i} className="ib-chip" style={{ background: "rgba(220,138,107,0.1)", color: "var(--ib-terra)", borderColor: "rgba(220,138,107,0.3)" }}>{w}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-4 pb-8">
              <button onClick={() => window.location.reload()} className="btn-ghost inline-flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Start New Session
              </button>
            </div>
          </div>
        )}

        {isEnded && !report && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <p className="text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif" }}>
              Session ended. Start a new one to get a full report.
            </p>
            <button onClick={() => window.location.reload()} className="btn-ghost inline-flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Start New Session
            </button>
          </div>
        )}
      </div>

      {/* Control bar */}
      {isActive && (
        <div
          className="shrink-0 px-4 sm:px-6 py-4"
          style={{ borderTop: "1px solid var(--ib-bdr)", background: "var(--ib-surf)" }}
        >
          <div className="flex items-center justify-between max-w-lg mx-auto gap-4">

            {/* Mic toggle — large chamfered amber button */}
            <button
              onClick={toggleListening}
              disabled={phase === "processing" || phase === "speaking" || phase === "starting"}
              className="flex flex-col items-center gap-1.5 px-5 py-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: phase === "listening" ? "rgba(245,158,11,0.15)" : "var(--ib-card2)",
                border: `1px solid ${phase === "listening" ? "var(--ib-amber)" : "var(--ib-bdr)"}`,
                clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)",
                animation: phase === "listening" ? "amber-pulse 2s infinite" : "none",
                minWidth: "64px",
              }}
            >
              {phase === "listening"
                ? <Mic className="h-6 w-6 animate-pulse" style={{ color: "var(--ib-amber)" }} />
                : <MicOff className="h-6 w-6" style={{ color: "var(--ib-muted)" }} />}
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: phase === "listening" ? "var(--ib-amber)" : "var(--ib-muted)" }}>
                {phase === "listening" ? <span className="blink">Listening…</span> : "Speak"}
              </span>
            </button>

            {/* Center info */}
            <div className="flex-1 text-center">
              {phase === "listening" && liveTranscript && (
                <p className="text-xs truncate max-w-xs mx-auto italic" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif" }}>
                  "{liveTranscript.slice(0, 80)}{liveTranscript.length > 80 ? "…" : ""}"
                </p>
              )}
              {phase === "processing" && (
                <div className="flex items-center justify-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--ib-amber)" }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.08em", color: "var(--ib-muted)" }}>AI is thinking…</span>
                </div>
              )}
              {phase === "speaking" && (
                <div className="flex items-center justify-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 animate-pulse" style={{ color: "var(--ib-purple)" }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.08em", color: "var(--ib-muted)" }}>AI speaking…</span>
                </div>
              )}
            </div>

            {/* End session — terracotta */}
            <button
              onClick={endSession}
              className="btn-terra flex flex-col items-center gap-1.5 px-5 py-3"
              style={{ minWidth: "64px" }}
            >
              <Square className="h-5 w-5" />
              <span style={{ fontSize: "0.5rem" }}>End</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
