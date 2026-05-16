/**
 * useAISession — Core hook for the AI speech-to-speech discussion session.
 *
 * Manages:
 *  - Session lifecycle (idle → active → ended)
 *  - Web Speech API for real-time STT
 *  - Conversation history
 *  - AI turn requests (via server)
 *  - ElevenLabs TTS playback (via server proxy)
 *  - Session timer
 *  - Report generation
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { apiFetch, getToken } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionPhase =
  | "idle"
  | "starting"
  | "listening"
  | "processing"
  | "speaking"
  | "ended";

export type MessageRole = "user" | "assistant";

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  ts: number;
}

export interface SessionReport {
  topic: string;
  duration: string;
  turns: number;
  transcript: string;
  analysis: {
    overallScore: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    grammarSuggestions: string[];
    contextualRelevance: string;
    communicationFeedback: string;
    improvements: string[];
    vocabularyScore: number;
    clarityScore: number;
    engagementScore: number;
  };
  generatedAt: string;
}

export interface UseAISessionReturn {
  phase: SessionPhase;
  topic: string;
  messages: ConversationMessage[];
  liveTranscript: string;
  elapsedSeconds: number;
  report: SessionReport | null;
  error: string | null;
  isTTSAvailable: boolean;
  startSession: (category?: string) => Promise<void>;
  endSession: () => Promise<void>;
  toggleListening: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL = (import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000").replace(/\/$/, "");

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAISession(): UseAISessionReturn {
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [topic, setTopic] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTTSAvailable, setIsTTSAvailable] = useState(
    typeof window !== "undefined" && !!window.speechSynthesis
  );

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const topicRef = useRef("");
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const phaseRef = useRef<SessionPhase>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isListeningRef = useRef(false);
  const pendingTranscriptRef = useRef("");

  // Keep phaseRef in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Add message to conversation ────────────────────────────────────────────
  const addMessage = useCallback((role: MessageRole, content: string) => {
    const msg: ConversationMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    historyRef.current = [
      ...historyRef.current,
      { role, content },
    ];
    return msg;
  }, []);

  // ── Browser TTS fallback (Web Speech Synthesis) ───────────────────────────
  const speakWithBrowserTTS = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }

      window.speechSynthesis.cancel();

      const speak = () => {
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 0.95;
        utt.pitch = 1;
        utt.volume = 1;

        const voices = window.speechSynthesis.getVoices();
        const preferred =
          voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Premium"))) ??
          voices.find((v) => v.lang.startsWith("en")) ??
          null;
        if (preferred) utt.voice = preferred;

        // Timeout safety net — Chrome sometimes never fires onend
        const timeout = setTimeout(() => resolve(), text.length * 80 + 2000);

        utt.onend = () => { clearTimeout(timeout); resolve(); };
        utt.onerror = () => { clearTimeout(timeout); resolve(); };
        window.speechSynthesis.speak(utt);
      };

      // Voices may not be loaded yet on first call — wait for them
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        speak();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          speak();
        };
        // If onvoiceschanged never fires, fall through after 1s
        setTimeout(() => { speak(); }, 1000);
      }
    });
  }, []);

  // ── TTS: speak AI response ─────────────────────────────────────────────────
  // Always resolves (never throws) so the caller can safely transition to listening.
  const speakText = useCallback(async (text: string): Promise<void> => {
    // Stop any ongoing recognition while AI speaks
    recognitionRef.current?.stop();
    isListeningRef.current = false;

    setPhase("speaking");
    phaseRef.current = "speaking";

    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/api/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS request failed");

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        // Server signals browser TTS fallback
        await speakWithBrowserTTS(text);
      } else {
        // ElevenLabs audio blob
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          audio.play().catch(() => resolve());
        });
      }
    } catch {
      // Any network/parse error — fall back to browser TTS
      await speakWithBrowserTTS(text).catch(() => {
        setIsTTSAvailable(false);
      });
    }

    // Always transition to listening after speaking (unless session ended)
    if (phaseRef.current !== "ended") {
      setPhase("listening");
      phaseRef.current = "listening";
      startListening();
    }
  }, [speakWithBrowserTTS]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send user transcript to AI ─────────────────────────────────────────────
  const sendTurn = useCallback(
    async (transcript: string) => {
      if (!transcript.trim() || phaseRef.current === "ended") return;

      setPhase("processing");
      phaseRef.current = "processing";
      setLiveTranscript("");

      addMessage("user", transcript);

      try {
        const data = await apiFetch<{ success: boolean; response: string }>(
          "/api/ai-session/turn",
          {
            method: "POST",
            body: {
              topic: topicRef.current,
              transcript,
              history: historyRef.current.slice(-12),
            },
          }
        );

        if (data.success && data.response) {
          addMessage("assistant", data.response);
          await speakText(data.response);
        }
      } catch (err) {
        setError((err as Error).message);
        setPhase("listening");
        phaseRef.current = "listening";
        startListening();
      }
    },
    [addMessage, speakText] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Web Speech API ─────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isListeningRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    isListeningRef.current = true;

    let finalBuffer = "";
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        finalBuffer += " " + final;
        pendingTranscriptRef.current = finalBuffer.trim();
      }

      setLiveTranscript((finalBuffer + " " + interim).trim());

      // Auto-send after 2.5s of silence following final results
      if (final) {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          const toSend = pendingTranscriptRef.current.trim();
          if (toSend && phaseRef.current === "listening") {
            finalBuffer = "";
            pendingTranscriptRef.current = "";
            recognition.stop();
            isListeningRef.current = false;
            sendTurn(toSend);
          }
        }, 2500);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("[speech]", event.error);
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      // Auto-restart if still in listening phase
      if (phaseRef.current === "listening") {
        setTimeout(() => {
          if (phaseRef.current === "listening") startListening();
        }, 300);
      }
    };

    recognition.start();
  }, [sendTurn]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setLiveTranscript("");
  }, []);

  // ── Start session ──────────────────────────────────────────────────────────
  const startSession = useCallback(
    async (category?: string) => {
      setError(null);
      setPhase("starting");
      setMessages([]);
      setReport(null);
      setElapsedSeconds(0);
      historyRef.current = [];

      try {
        const data = await apiFetch<{
          success: boolean;
          topic: string;
          opening: string;
        }>("/api/ai-session/start", {
          method: "POST",
          body: { category },
        });

        if (!data.success) throw new Error("Failed to start session");

        topicRef.current = data.topic;
        setTopic(data.topic);

        addMessage("assistant", data.opening);
        startTimer();

        await speakText(data.opening);
      } catch (err) {
        setError((err as Error).message);
        setPhase("idle");
      }
    },
    [addMessage, startTimer, speakText]
  );

  // ── End session ────────────────────────────────────────────────────────────
  const endSession = useCallback(async () => {
    stopListening();
    stopTimer();
    audioRef.current?.pause();

    setPhase("ended");
    phaseRef.current = "ended";

    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    if (historyRef.current.length < 2) {
      setReport(null);
      return;
    }

    try {
      const data = await apiFetch<{ success: boolean; report: SessionReport }>(
        "/api/ai-session/report",
        {
          method: "POST",
          body: {
            topic: topicRef.current,
            history: historyRef.current,
            durationSeconds: duration,
          },
        }
      );
      if (data.success) setReport(data.report);
    } catch (err) {
      console.error("[ai-session] report generation failed:", err);
    }
  }, [stopListening, stopTimer]);

  // ── Toggle listening manually ──────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    const p = phaseRef.current;

    if (p === "speaking") {
      // Interrupt AI speech
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
      setPhase("listening");
      phaseRef.current = "listening";
      startListening();
      return;
    }

    if (p === "listening") {
      // Send whatever was captured so far
      const toSend = pendingTranscriptRef.current.trim() || liveTranscript.trim();
      stopListening();
      if (toSend) {
        sendTurn(toSend);
      } else {
        // Nothing captured — just stop listening
        setPhase("idle");
        phaseRef.current = "idle";
      }
      return;
    }

    // idle or any other non-processing state — start listening
    if (p !== "processing" && p !== "starting" && p !== "ended") {
      setPhase("listening");
      phaseRef.current = "listening";
      startListening();
    }
  }, [liveTranscript, sendTurn, startListening, stopListening]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopListening();
      stopTimer();
      audioRef.current?.pause();
    };
  }, [stopListening, stopTimer]);

  return {
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
  };
}
