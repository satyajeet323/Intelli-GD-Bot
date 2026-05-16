/**
 * useAITopic — Topic generation via the Node server (/api/topics/generate).
 *
 * The server tries Gemini first and falls back to a local pool on 429,
 * so this hook always gets a topic — it never errors on rate limits.
 *
 * Resilience:
 *  - 5-minute module-level cache
 *  - In-flight dedup — concurrent mounts share one fetch
 *  - StrictMode safe — cleanup marks the effect stale but doesn't abort the
 *    shared network request, so the result is cached for the real mount
 */

import { useState, useEffect, useRef } from "react";

export type TopicSource = "gemini" | "local";

export interface UseAITopicResult {
  topic:           string;
  source:          TopicSource;
  ready:           boolean;
  error:           string | null;
  regenerate:      () => void;
  setTopicOverride:(t: string) => void;
}

type TopicResult = { topic: string; source: TopicSource };

const BASE_URL  = (import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000").replace(/\/$/, "");
const CACHE_TTL = 5 * 60 * 1000;

// ── Module-level cache & dedup ────────────────────────────────────────────────
let _cached: TopicResult | null = null;
let _cacheExpiresAt = 0;
let _inflight: Promise<TopicResult> | null = null;

function getCached(): TopicResult | null {
  return _cached && Date.now() < _cacheExpiresAt ? _cached : null;
}
function setCache(r: TopicResult) {
  _cached         = r;
  _cacheExpiresAt = Date.now() + CACHE_TTL;
}

async function fetchTopic(): Promise<TopicResult> {
  const res = await fetch(`${BASE_URL}/api/topics/generate`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { message?: string }).message ??
      `Topic generation failed (HTTP ${res.status})`
    );
  }
  const data = await res.json() as { success: boolean; topic?: string; source?: string };
  if (!data.topic) throw new Error("Server returned an empty topic.");
  return { topic: data.topic, source: (data.source as TopicSource) ?? "gemini" };
}

function getTopicOnce(): Promise<TopicResult> {
  if (!_inflight) {
    _inflight = fetchTopic().finally(() => { _inflight = null; });
  }
  return _inflight;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAITopic(): UseAITopicResult {
  const [state, setState] = useState<{
    topic:  string;
    source: TopicSource;
    ready:  boolean;
    error:  string | null;
  }>({ topic: "", source: "gemini", ready: false, error: null });

  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    const cached = getCached();
    if (cached) {
      setState({ topic: cached.topic, source: cached.source, ready: true, error: null });
      return;
    }

    getTopicOnce()
      .then((result) => {
        if (!alive.current) return;
        setCache(result);
        setState({ topic: result.topic, source: result.source, ready: true, error: null });
      })
      .catch((err: Error) => {
        if (!alive.current) return;
        const msg = err.message ?? "Topic generation failed.";
        console.error("[useAITopic]", msg);
        setState({ topic: "", source: "gemini", ready: false, error: msg });
      });

    return () => { alive.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const regenerate = () => {
    _cached         = null;
    _cacheExpiresAt = 0;
    _inflight       = null;
    setState({ topic: "", source: "gemini", ready: false, error: null });
    setTick((t) => t + 1);
  };

  const setTopicOverride = (t: string) => {
    setState({ topic: t, source: "gemini", ready: true, error: null });
  };

  return { ...state, regenerate, setTopicOverride };
}
