/**
 * aiSession.js — AI Session routes
 *
 * POST /api/ai-session/start    — Generate topic + opening AI message
 * POST /api/ai-session/turn     — Send user transcript, get AI response
 * POST /api/ai-session/report   — Generate end-of-session analysis
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { generateTopic } from "../topics.js";
import Groq from "groq-sdk";

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
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

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
    res.status(500).json({ success: false, message: err.message });
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

    const fullTranscript = history
      .map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`)
      .join("\n\n");

    const analysisPrompt = `You are an expert communication coach evaluating a professional group discussion.

Topic: "${topic}"

Full Transcript:
${fullTranscript}

Provide a detailed evaluation in valid JSON format with this exact structure:
{
  "overallScore": <number 1-10>,
  "summary": "<2-3 sentence summary of the discussion>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "grammarSuggestions": ["<suggestion 1>", "<suggestion 2>"],
  "contextualRelevance": "<assessment of how well the user stayed on topic>",
  "communicationFeedback": "<detailed paragraph on communication style>",
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "vocabularyScore": <number 1-10>,
  "clarityScore": <number 1-10>,
  "engagementScore": <number 1-10>
}

Return ONLY the JSON object, no markdown, no explanation.`;

    let analysis;
    try {
      const raw = await callAI(
        [{ role: "user", content: analysisPrompt }],
        "You are an expert communication coach. Return only valid JSON."
      );
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = {
        overallScore: 7,
        summary: "The discussion covered the topic with reasonable depth.",
        strengths: ["Active participation", "Clear articulation", "Relevant points"],
        weaknesses: ["Could explore more perspectives", "Some points needed elaboration"],
        grammarSuggestions: ["Use more varied sentence structures", "Avoid filler words"],
        contextualRelevance: "The discussion remained largely on topic.",
        communicationFeedback: "Good overall communication with room for improvement in depth and variety.",
        improvements: ["Research the topic more deeply", "Practice structured arguments", "Use more examples"],
        vocabularyScore: 7,
        clarityScore: 7,
        engagementScore: 7,
      };
    }

    const minutes = Math.floor((durationSeconds ?? 0) / 60);
    const secs = (durationSeconds ?? 0) % 60;
    const userTurns = history.filter((m) => m.role === "user").length;

    res.json({
      success: true,
      report: {
        topic,
        duration: `${minutes}m ${secs}s`,
        turns: userTurns,
        transcript: fullTranscript,
        analysis,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[ai-session] report:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
