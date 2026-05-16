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

    const userMessages = history.filter((m) => m.role === "user");
    const userTurns = userMessages.length;

    // Build a rich, data-driven prompt so Gemini evaluates THIS user's actual words
    const userText = userMessages.map((m) => m.content).join(" ");
    const wordCount = userText.trim().split(/\s+/).filter(Boolean).length;
    const avgWordsPerTurn = userTurns > 0 ? Math.round(wordCount / userTurns) : 0;

    const analysisPrompt = `You are an expert communication coach evaluating a real professional group discussion.

Topic: "${topic}"
User spoke ${userTurns} turn(s), ${wordCount} total words, ~${avgWordsPerTurn} words per turn.

Full Transcript (You = user, AI = discussion partner):
${fullTranscript}

Analyse ONLY the "You:" lines above. Base every score and comment strictly on what the user actually said — vocabulary choices, argument quality, grammar, topic relevance, engagement level, and communication style. Do NOT produce generic or template feedback.

Return a single valid JSON object with this exact structure (no markdown, no extra text):
{
  "overallScore": <integer 1-10 reflecting the user's actual performance>,
  "summary": "<2-3 sentences describing what THIS user specifically discussed and how well they argued their points>",
  "strengths": ["<specific strength observed in the transcript>", "<another specific strength>", "<third specific strength>"],
  "weaknesses": ["<specific weakness observed>", "<another specific weakness>"],
  "grammarSuggestions": ["<quote an actual phrase from the transcript and suggest a correction>", "<another grammar note>"],
  "contextualRelevance": "<assess how closely the user's arguments tied to the topic '${topic}'>",
  "communicationFeedback": "<detailed paragraph on this user's communication style, referencing specific things they said>",
  "improvements": ["<actionable improvement based on what was observed>", "<second improvement>", "<third improvement>"],
  "vocabularyScore": <integer 1-10 based on vocabulary richness in the transcript>,
  "clarityScore": <integer 1-10 based on how clearly the user expressed ideas>,
  "engagementScore": <integer 1-10 based on how actively and thoughtfully the user engaged>
}`;

    let analysis = null;

    // Attempt 1: primary AI call
    try {
      const raw = await callAI(
        [{ role: "user", content: analysisPrompt }],
        "You are an expert communication coach. Analyse the provided transcript carefully and return only valid JSON."
      );
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      analysis = JSON.parse(cleaned);
    } catch (firstErr) {
      console.warn("[ai-session] report attempt 1 failed:", firstErr.message);

      // Attempt 2: retry with a simpler, more constrained prompt
      try {
        const retryPrompt = `Evaluate this discussion transcript for the topic "${topic}".
User turns only:
${userMessages.map((m, i) => `Turn ${i + 1}: ${m.content}`).join("\n")}

Return ONLY this JSON (integers 1-10, no markdown):
{"overallScore":0,"summary":"","strengths":[],"weaknesses":[],"grammarSuggestions":[],"contextualRelevance":"","communicationFeedback":"","improvements":[],"vocabularyScore":0,"clarityScore":0,"engagementScore":0}`;

        const raw2 = await callAI(
          [{ role: "user", content: retryPrompt }],
          "Return only valid JSON. No markdown."
        );
        const cleaned2 = raw2.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        analysis = JSON.parse(cleaned2);
      } catch (secondErr) {
        console.error("[ai-session] report attempt 2 failed:", secondErr.message);
        // Both AI calls failed — return an error rather than fake scores
        return res.status(503).json({
          success: false,
          message: "AI analysis service is temporarily unavailable. Please try again.",
        });
      }
    }

    const minutes = Math.floor((durationSeconds ?? 0) / 60);
    const secs = (durationSeconds ?? 0) % 60;

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
