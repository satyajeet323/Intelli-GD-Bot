/**
 * gd.$sessionId.tsx — English Fluency Session
 *
 * Records audio via MediaRecorder, uploads to the Node proxy → FastAPI backend,
 * runs Whisper transcription + CRNN filler detection + Semantic relevance scoring,
 * then calls Gemini for a structured fluency report.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, Square, Sparkles, Loader2, RotateCw, ArrowLeft,
  Activity, Upload, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAITopic } from "@/lib/useAITopic";
import { fluency, sessions as sessionsApi, reports, getToken } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

export const Route = createFileRoute("/gd/$sessionId")({
  head: () => ({
    meta: [
      { title: "Fluency Session — INTELLI BOT" },
      { name: "description", content: "Record your speech and get real-time English fluency analysis." },
    ],
  }),
  component: FluencySession,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "recording" | "uploading" | "scoring" | "done" | "error";

type ProsodyMetrics = {
  duration_sec:          number;
  speech_rate_wpm:       number;
  syllable_nuclei_count: number;
  nPVI:                  number | null;
  pause_ratio:           number;
  total_pause_s:         number;
  fillers:               number;
  relevance_score?:      number;
};

type FluencyScores = {
  vocabulary_score:           number;
  grammar_score:              number;
  sentence_correctness_score: number;
  coherence_score:            number;
  clarity_score:              number;
  relevance_score:            number;
  // Gemini may return these as a string OR a structured object/array
  grammatical_mistake:        string | unknown;
  improvement_needed:         string | unknown;
  speech_rate_score:          number;
  pause_time_score:           number;
  pitch_variability_score:    number;
  rhythm_variability_score:   number;
  fillers_score:              number;
};

// Safely convert any Gemini field to a plain string
function toStr(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v.map((item) =>
      typeof item === "object" && item !== null
        ? Object.entries(item).map(([k, val]) => `${k}: ${val}`).join("\n")
        : String(item)
    ).join("\n\n");
  }
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

type SessionResult = {
  transcript:   string;
  prosody:      ProsodyMetrics;
  scores:       FluencyScores;
  overallScore: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcOverall(s: FluencyScores): number {
  const vals = [
    s.vocabulary_score, s.grammar_score, s.sentence_correctness_score,
    s.coherence_score, s.clarity_score, s.relevance_score,
    s.speech_rate_score, s.pause_time_score, s.pitch_variability_score,
    s.rhythm_variability_score, s.fillers_score,
  ].filter((v) => typeof v === "number" && !isNaN(v));
  if (!vals.length) return 0;
  return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
}

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function scoreTone(v: number): "good" | "warn" | "bad" {
  if (v >= 7) return "good";
  if (v >= 4) return "warn";
  return "bad";
}

// ─── Main component ────────────────────────────────────────────────────────────

function FluencySession() {
  const navigate               = useNavigate();
  const { sessionId: routeId } = Route.useParams();
  const { topic, ready, error: topicError, regenerate } = useAITopic();
  const { user: _user }        = useCurrentUser();

  const [phase,       setPhase]       = useState<Phase>("idle");
  const [recDuration, setRecDuration] = useState(0);
  const [uploadPct,   setUploadPct]   = useState(0);
  const [result,      setResult]      = useState<SessionResult | null>(null);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [pythonDown,  setPythonDown]  = useState(false);
  const [dbSessionId, setDbSessionId] = useState<string | null>(
    routeId !== "new" ? routeId : null
  );

  const mediaRecRef    = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<Blob[]>([]);
  const recIntervalRef = useRef<number | null>(null);
  const dbCreating     = useRef(false);
  const topicRef       = useRef("");
  const dbSessionIdRef = useRef<string | null>(null);

  topicRef.current       = topic;
  dbSessionIdRef.current = dbSessionId;

  // ── Create DB session once topic is ready ──────────────────────────────────
  useEffect(() => {
    if (!ready || !topic || dbSessionId || dbCreating.current || !getToken()) return;
    dbCreating.current = true;
    sessionsApi.create({ type: "individual", topic })
      .then((res) => setDbSessionId(res.session.sessionId))
      .catch((err) => console.warn("[Fluency] DB create failed:", err.message))
      .finally(() => { dbCreating.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, topic]);

  // ── Check Python server is reachable ───────────────────────────────────────
  useEffect(() => {
    fluency.health()
      .then((r) => setPythonDown(!r.online))
      .catch(() => setPythonDown(true));
  }, []);

  // ── Prevent accidental navigation during recording ─────────────────────────
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  // ── Reset for new topic ────────────────────────────────────────────────────
  const handleRegenerate = useCallback(() => {
    if (phase === "recording") {
      if (recIntervalRef.current) { window.clearInterval(recIntervalRef.current); recIntervalRef.current = null; }
      try { mediaRecRef.current?.stop(); } catch { /* ignore */ }
    }
    setPhase("idle");
    setResult(null);
    setErrorMsg("");
    setRecDuration(0);
    setUploadPct(0);
    setDbSessionId(null);
    dbCreating.current = false;
    regenerate();
  }, [phase, regenerate]);

  // ── Process audio: upload → transcribe → score ─────────────────────────────
  const processAudio = useCallback(async (blob: Blob, mimeType: string) => {
    const t = topicRef.current;
    if (!t) {
      setPhase("error");
      setErrorMsg("Topic not ready. Please wait and try again.");
      return;
    }

    setPhase("uploading");
    setUploadPct(0);

    try {
      const ext = mimeType.includes("ogg") ? "ogg" : "webm";
      const uploadResult = await fluency.upload(blob, ext, (pct) => setUploadPct(pct));

      if ((uploadResult as { error?: string }).error) {
        throw new Error((uploadResult as { error: string }).error);
      }

      const { transcript, prosody } = uploadResult as { transcript: string; prosody: ProsodyMetrics };

      if (!transcript || transcript.trim().length === 0) {
        throw new Error("No speech detected. Please speak clearly and try again.");
      }

      setPhase("scoring");
      const scoreResult = await fluency.score(transcript, t, prosody);

      if ((scoreResult as { error?: string }).error) {
        throw new Error((scoreResult as { error: string }).error);
      }
      if ((scoreResult as { status?: string }).status === "error") {
        throw new Error((scoreResult as { message?: string }).message ?? "Scoring failed.");
      }

      const scores = (scoreResult as { score: FluencyScores }).score;
      const overallScore = calcOverall(scores);
      const sessionResult: SessionResult = { transcript, prosody, scores, overallScore };
      setResult(sessionResult);
      setPhase("done");

      // Persist to DB (best-effort)
      const dbSid = dbSessionIdRef.current;
      if (dbSid && getToken()) {
        reports.submit(dbSid, {
          fluency:       scores.fillers_score,
          relevance:     scores.relevance_score,
          confidence:    scores.speech_rate_score,
          fillerWords:   prosody.fillers ?? 0,
          turns:         1,
          feedback:      toStr(scores.improvement_needed).slice(0, 1900),
          aiFeedback:    toStr(scores.grammatical_mistake).slice(0, 1900),
          peerScore:     null,
          peerFeedback:  "",
          combinedScore: null,
        }).catch(() => {});
        sessionsApi.end(dbSid).catch(() => {});
      }

      toast.success("Analysis complete!");
    } catch (err) {
      const msg = (err as Error).message ?? "Processing failed.";
      setErrorMsg(msg);
      setPhase("error");
      toast.error(msg);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const rec = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        processAudio(blob, mimeType);
      };

      rec.start(250);
      mediaRecRef.current = rec;
      setPhase("recording");
      setRecDuration(0);
      recIntervalRef.current = window.setInterval(() => setRecDuration((d) => d + 1), 1000);
    } catch {
      toast.error("Microphone access denied. Please allow microphone access and try again.");
    }
  }, [processAudio]);

  // ── Stop recording ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (recIntervalRef.current) { window.clearInterval(recIntervalRef.current); recIntervalRef.current = null; }
    setRecDuration(0);
    try { mediaRecRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const toggleRecord = useCallback(() => {
    if (phase === "recording") stopRecording();
    else if (phase === "idle") startRecording();
  }, [phase, startRecording, stopRecording]);

  const isRecording = phase === "recording";
  const isBusy      = phase === "uploading" || phase === "scoring";
  const isDone      = phase === "done";
  const isError     = phase === "error";

  return (
    <div className="animate-fade-in px-4 sm:px-6 py-6 max-w-3xl mx-auto space-y-5 pb-16">

      {/* Topic card */}
      <div>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to Dashboard
        </Link>
        <div className="relative overflow-hidden rounded-2xl glass-strong px-4 py-3 sm:px-5 sm:py-4">
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl gradient-cosmic flex items-center justify-center shadow-glow shrink-0">
              {!ready ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Sparkles className="h-4 w-4 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Today's topic</p>
                {ready && (
                  <span className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-full font-semibold bg-accent/20 text-accent border border-accent/30">
                    ✦ Gemini
                  </span>
                )}
              </div>
              {topicError ? (
                <div className="flex items-center gap-1.5 text-destructive text-xs">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{topicError}</span>
                </div>
              ) : (
                <p className="font-display text-sm sm:text-base font-semibold leading-snug truncate">
                  {!ready ? <span className="text-muted-foreground animate-pulse">Generating topic…</span> : topic}
                </p>
              )}
            </div>
            <button
              title="New topic" disabled={!ready || isBusy || isRecording}
              className="h-8 w-8 rounded-lg glass hover:shadow-glow grid place-items-center transition shrink-0 disabled:opacity-40"
              onClick={handleRegenerate}
            >
              <RotateCw className={`h-3.5 w-3.5 ${!ready ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Python server down banner */}
      {pythonDown && (
        <div className="glass rounded-2xl p-4 border border-destructive/40 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Analysis server offline</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The Python processing server is not running. Start it with:
            </p>
            <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block font-mono">
              uvicorn main:app --port 8000
            </code>
          </div>
        </div>
      )}

      {/* Instructions */}
      {phase === "idle" && (
        <div className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-display text-sm font-semibold">How it works</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Read the topic above and prepare your thoughts.</li>
            <li>Press the microphone button and speak for at least 30–60 seconds.</li>
            <li>Press stop when done — your audio is uploaded and analysed.</li>
            <li>Get a detailed fluency report with scores, grammar feedback, and tips.</li>
          </ol>
        </div>
      )}

      {/* Recording control */}
      {(phase === "idle" || phase === "recording") && (
        <div className="glass rounded-2xl p-6 flex flex-col items-center gap-4">
          <button
            onClick={toggleRecord}
            disabled={!ready || isBusy || !!topicError || pythonDown}
            className={`relative h-20 w-20 rounded-full grid place-items-center transition-all disabled:opacity-40 ${
              isRecording
                ? "bg-destructive text-white shadow-[0_0_30px_rgba(239,68,68,0.5)]"
                : "gradient-cosmic text-white shadow-glow hover:scale-105"
            }`}
          >
            {isRecording ? <Square className="h-7 w-7 fill-current" /> : <Mic className="h-8 w-8" />}
            {isRecording && <PulseRing />}
          </button>
          {isRecording ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 text-sm text-destructive font-medium">
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                Recording — {fmt(recDuration)}
              </div>
              <p className="text-xs text-muted-foreground">Press stop when finished speaking</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm font-medium">Press to start recording</p>
              <p className="text-xs text-muted-foreground">Speak about the topic for at least 30 seconds</p>
            </div>
          )}
        </div>
      )}

      {/* Processing state */}
      {isBusy && (
        <div className="glass rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full gradient-cosmic flex items-center justify-center shadow-glow">
            <Loader2 className="h-7 w-7 text-white animate-spin" />
          </div>
          {phase === "uploading" && (
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Upload className="h-3 w-3" /> Uploading audio…</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-background/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          )}
          {phase === "scoring" && (
            <div className="text-center space-y-1">
              <p className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent animate-pulse" />
                Analysing fluency…
              </p>
              <p className="text-xs text-muted-foreground">Running Whisper, CRNN filler detection, and Gemini scoring</p>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="glass rounded-2xl p-6 flex flex-col items-center gap-4 border border-destructive/30">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div className="text-center">
            <p className="font-medium text-sm">Analysis failed</p>
            <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
          </div>
          <button onClick={() => { setPhase("idle"); setErrorMsg(""); }} className="rounded-xl border border-border/60 px-4 py-2 text-sm hover:bg-muted transition">
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {isDone && result && (
        <FluencyResults result={result} topic={topic} onRetry={handleRegenerate} navigate={navigate} dbSessionId={dbSessionId} />
      )}
    </div>
  );
}

// ─── Results component ─────────────────────────────────────────────────────────

function FluencyResults({
  result,
  topic,
  onRetry,
  navigate,
  dbSessionId,
}: {
  result: SessionResult;
  topic: string;
  onRetry: () => void;
  navigate: ReturnType<typeof useNavigate>;
  dbSessionId: string | null;
}) {
  const { scores, prosody, transcript, overallScore } = result;

  const languageScores: { label: string; value: number }[] = [
    { label: "Vocabulary", value: scores.vocabulary_score ?? 0 },
    { label: "Grammar",    value: scores.grammar_score ?? 0 },
    { label: "Sentence",   value: scores.sentence_correctness_score ?? 0 },
    { label: "Coherence",  value: scores.coherence_score ?? 0 },
    { label: "Clarity",    value: scores.clarity_score ?? 0 },
    { label: "Relevance",  value: scores.relevance_score ?? 0 },
  ];

  const prosodyScores: { label: string; value: number }[] = [
    { label: "Speech Rate", value: scores.speech_rate_score ?? 0 },
    { label: "Pause Time",  value: scores.pause_time_score ?? 0 },
    { label: "Pitch",       value: scores.pitch_variability_score ?? 0 },
    { label: "Rhythm",      value: scores.rhythm_variability_score ?? 0 },
    { label: "Fillers",     value: scores.fillers_score ?? 0 },
  ];

  return (
    <div className="space-y-5 pb-20">
      {/* Overall score hero */}
      <div className="glass rounded-2xl p-6 flex items-center gap-5">
        <div className="h-20 w-20 rounded-2xl gradient-cosmic flex flex-col items-center justify-center shadow-glow shrink-0">
          <span className="font-display text-2xl font-bold text-white">{overallScore.toFixed(1)}</span>
          <span className="text-[9px] text-white/70 uppercase tracking-widest">/ 10</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm font-semibold">Analysis complete</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">Topic: {topic}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border/50">
              {prosody.duration_sec.toFixed(0)}s recorded
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border/50">
              ~{prosody.speech_rate_wpm.toFixed(0)} WPM
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border/50">
              {prosody.fillers ?? 0} filler segments
            </span>
          </div>
        </div>
      </div>

      {/* Language scores */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Language</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {languageScores.map(({ label, value }) => (
            <ScoreCard key={label} label={label} value={value} />
          ))}
        </div>
      </div>

      {/* Prosody / Delivery scores */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Delivery</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {prosodyScores.map(({ label, value }) => (
            <ScoreCard key={label} label={label} value={value} />
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Transcript</h3>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{transcript}</p>
      </div>

      {/* Grammar feedback */}
      {!!scores.grammatical_mistake && (
        <div className="glass rounded-2xl p-5 border border-warning/20">
          <h3 className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Grammar Feedback</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{toStr(scores.grammatical_mistake)}</p>
        </div>
      )}

      {/* Improvement tips */}
      {!!scores.improvement_needed && (
        <div className="glass rounded-2xl p-5 border border-accent/20">
          <h3 className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Improvement Tips</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{toStr(scores.improvement_needed)}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 rounded-xl border border-border/60 px-4 py-3 text-sm font-semibold hover:bg-muted transition flex items-center justify-center gap-2"
        >
          <RotateCw className="h-4 w-4" /> New Session
        </button>
        {dbSessionId && (
          <button
            onClick={() => navigate({ to: "/report/$sessionId", params: { sessionId: dbSessionId } })}
            className="flex-1 rounded-xl gradient-cosmic px-4 py-3 text-sm font-semibold text-white shadow-glow hover:opacity-90 transition"
          >
            View Full Report
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScoreCard({ label, value }: { label: string; value: number }): React.JSX.Element {
  const tone = scoreTone(value);
  const borderBg = { good: "border-success/30 bg-success/5", warn: "border-warning/30 bg-warning/5", bad: "border-destructive/30 bg-destructive/5" } as const;
  const textColor = { good: "text-success", warn: "text-warning", bad: "text-destructive" } as const;
  const barColor  = { good: "bg-success", warn: "bg-warning", bad: "bg-destructive" } as const;

  return (
    <div className={`rounded-xl border p-3 ${borderBg[tone]}`}>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className={`font-display text-2xl font-bold ${textColor[tone]}`}>{value}</div>
      <div className="mt-1.5 h-1.5 rounded-full bg-background/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor[tone]}`}
          style={{ width: `${Math.max(0, Math.min(100, value * 10))}%` }}
        />
      </div>
    </div>
  );
}

function PulseRing() {
  return <span className="absolute inset-0 rounded-full border-2 border-destructive animate-ping opacity-60" />;
}
