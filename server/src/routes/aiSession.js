/**
 * aiSession.js — AI Session routes
 *
 * POST /api/ai-session/start    — Generate topic + opening AI message
 * POST /api/ai-session/turn     — Send user transcript, get AI response
 * POST /api/ai-session/report   — Delegate session evaluation to ML service
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { generateTopic } from "../topics.js";
import Groq from "groq-sdk";
import { evaluateSession } from "../services/mlClient.js";

const router = Router();

// ── Groq client ───────────────────────────────────────────────────────────────
let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

// ── Gemini REST helper (reuses same pattern as topics.js) ─────────────────────
const GEMINI_CHAT_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function callGeminiRest(systemPrompt, messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw Object.assign(
      new Error("No AI API keys configured. Set GEMINI_API_KEY or GROQ_API_KEY in server/.env"),
      { status: 503 }
    );
  }

  // Build Gemini contents array from messages
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${GEMINI_CHAT_URL}?key=${apiKey}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 350, temperature: 0.85 },
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const err = new Error(`Gemini HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const json = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  } finally {
    clearTimeout(timer);
  }
}

// ── Primary AI call: Groq first, Gemini fallback ──────────────────────────────
async function callAI(messages, systemPrompt) {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const groq = getGroq();
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 300,
        temperature: 0.85,
      });
      return completion.choices[0]?.message?.content?.trim() ?? "";
    } catch (err) {
      console.warn("[ai-session] Groq failed, trying Gemini:", err.message);
    }
  }
  return callGeminiRest(systemPrompt, messages);
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(topic) {
  return `You are an expert discussion facilitator and debate partner in a professional group discussion.

The discussion topic is: "${topic}"

Your role:
- Be an engaged, intelligent discussion partner
- Ask probing follow-up questions to deepen the conversation
- Challenge opinions respectfully with counter-arguments
- Share your own perspective when relevant
- Keep responses concise (2-4 sentences max)
- Maintain natural conversational flow
- Reference what the user said to show you are listening
- Occasionally summarise key points made so far

Tone: Professional yet conversational. Intellectually stimulating. Encouraging.
Never be preachy. Never lecture. Keep it a dialogue.`;
}

// ── POST /api/ai-session/start ────────────────────────────────────────────────
router.post("/start", requireAuth, async (req, res) => {
  try {
    const { category } = req.body;
    const { topic, source } = await generateTopic({ category });

    const systemPrompt = buildSystemPrompt(topic);
    const messages = [
      {
        role: "user",
        content: `The discussion topic is: "${topic}". Please open the discussion with an engaging question or statement to get us started. Keep it to 2-3 sentences.`,
      },
    ];

    const opening = await callAI(messages, systemPrompt);

    res.json({ success: true, topic, source, opening });
  } catch (err) {
    console.error("[ai-session] start:", err.message);
    res.status(err.status ?? 500).json({ success: false, message: err.message });
  }
});

// ── POST /api/ai-session/turn ─────────────────────────────────────────────────
router.post("/turn", requireAuth, async (req, res) => {
  try {
    const { topic, transcript, history } = req.body;

    if (!topic || !transcript) {
      return res.status(400).json({ success: false, message: "topic and transcript are required." });
    }

    const systemPrompt = buildSystemPrompt(topic);
    const recentHistory = (history ?? []).slice(-12);
    const messages = [...recentHistory, { role: "user", content: transcript }];

    const response = await callAI(messages, systemPrompt);

    res.json({ success: true, response });
  } catch (err) {
    console.error("[ai-session] turn:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/ai-session/report ───────────────────────────────────────────────
router.post("/report", requireAuth, async (req, res) => {
  try {
    const { topic, history, durationSeconds } = req.body;

    if (!topic || !history?.length) {
      return res.status(400).json({ success: false, message: "topic and history are required." });
    }

    // Delegate all ML-based evaluation to the FastAPI ML service
    const { report } = await evaluateSession(topic, history, durationSeconds ?? 0);

    res.json({ success: true, report });
  } catch (err) {
    console.error("[ai-session] report:", err.message);
    const status = err.status ?? 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

export default router;
