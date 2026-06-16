/**
 * services/mlClient.js — HTTP client for the FastAPI ML microservice.
 *
 * All ML-related calls from Node.js go through this module.
 * Handles:
 *  - Timeout enforcement
 *  - Retry with exponential backoff
 *  - Health check / availability flag
 *  - Consistent error propagation
 *
 * ML_SERVER_URL defaults to http://localhost:8000
 */

import axios from "axios";
import FormData from "form-data";

const ML_URL = process.env.ML_SERVER_URL ?? "http://localhost:8000";
const TIMEOUT_DEFAULT  = 60_000;   // 60 s
const TIMEOUT_AUDIO    = 120_000;  // 2 min — Whisper can be slow
const RETRY_ATTEMPTS   = 2;
const RETRY_BACKOFF_MS = 1_000;

// ── Availability flag (set by startup health check) ───────────────────────────
let _mlAvailable = false;

export function isMLAvailable() { return _mlAvailable; }
export function setMLAvailable(v) { _mlAvailable = v; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function isServiceDown(err) {
  return (
    err.code === "ECONNREFUSED" ||
    err.code === "ECONNRESET"   ||
    err.code === "ENOTFOUND"    ||
    err.code === "ETIMEDOUT"
  );
}

function mlUnavailableError() {
  const e = new Error(
    "ML service is not available. Start it with: uvicorn main:app --port 8000 (in ml-server/)"
  );
  e.status = 503;
  return e;
}

async function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Generic ML request with retry.
 * @param {Function} fn  — async () => axios response
 * @param {number}   attempts
 */
async function _withRetry(fn, attempts = RETRY_ATTEMPTS) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isServiceDown(err)) { _mlAvailable = false; throw mlUnavailableError(); }
      if (i < attempts - 1) await _sleep(RETRY_BACKOFF_MS * (i + 1));
    }
  }
  throw lastErr;
}

// ── Health check ──────────────────────────────────────────────────────────────
/**
 * Ping the ML service health endpoint.
 * @returns {Promise<boolean>}
 */
export async function checkMLHealth() {
  try {
    const r = await axios.get(`${ML_URL}/health`, { timeout: 5_000 });
    _mlAvailable = r.data?.status === "ok";
    return _mlAvailable;
  } catch {
    _mlAvailable = false;
    return false;
  }
}

// ── Audio analysis ────────────────────────────────────────────────────────────
/**
 * Forward audio file bytes to POST /analyze/audio.
 *
 * @param {Buffer}   fileBuffer
 * @param {string}   filename
 * @param {string}   mimeType
 * @returns {Promise<{transcript, prosody, timings}>}
 */
export async function analyzeAudio(fileBuffer, filename, mimeType) {
  return _withRetry(async () => {
    const form = new FormData();
    form.append("audio", fileBuffer, { filename, contentType: mimeType });

    const r = await axios.post(`${ML_URL}/analyze/audio`, form, {
      headers:          form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
      timeout:          TIMEOUT_AUDIO,
    });
    return r.data;
  });
}

// ── Transcript scoring ────────────────────────────────────────────────────────
/**
 * Score a transcript against a topic via POST /analyze/transcript.
 *
 * @param {string} transcript
 * @param {string} topic
 * @param {object} prosody
 * @returns {Promise<{score: object}>}
 */
export async function scoreTranscript(transcript, topic, prosody = {}) {
  return _withRetry(async () => {
    const r = await axios.post(
      `${ML_URL}/analyze/transcript`,
      { transcript, topic, prosody },
      { headers: { "Content-Type": "application/json" }, timeout: TIMEOUT_DEFAULT }
    );
    return r.data;
  });
}

// ── Session evaluation ────────────────────────────────────────────────────────
/**
 * Evaluate an AI session conversation via POST /evaluate/session.
 *
 * @param {string}   topic
 * @param {Array}    history    — [{role, content}, ...]
 * @param {number}   durationSeconds
 * @returns {Promise<{report: object}>}
 */
export async function evaluateSession(topic, history, durationSeconds = 0) {
  return _withRetry(async () => {
    const r = await axios.post(
      `${ML_URL}/evaluate/session`,
      { topic, history, duration_seconds: durationSeconds },
      { headers: { "Content-Type": "application/json" }, timeout: TIMEOUT_DEFAULT }
    );
    return r.data;
  });
}

// ── GD report scoring ─────────────────────────────────────────────────────────
/**
 * Calculate overall score + feedback via POST /generate/report.
 *
 * @param {{ fluency, relevance, confidence, filler_words, turns }} metrics
 * @returns {Promise<{overall_score, feedback, metrics}>}
 */
export async function generateReport(metrics) {
  return _withRetry(async () => {
    const r = await axios.post(
      `${ML_URL}/generate/report`,
      metrics,
      { headers: { "Content-Type": "application/json" }, timeout: 10_000 }
    );
    return r.data;
  });
}

// ── Fluency topic (legacy compat) ─────────────────────────────────────────────
/**
 * Fetch a discussion topic from GET /api/fluency/topic (legacy path on ML server).
 */
export async function getFluencyTopic() {
  return _withRetry(async () => {
    const r = await axios.get(`${ML_URL}/api/fluency/topic`, { timeout: 15_000 });
    return r.data;
  });
}
