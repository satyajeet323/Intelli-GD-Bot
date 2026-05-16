/**
 * topics.js — Topic generation via Gemini, with local pool fallback on 429.
 *
 * The local pool is only used when Gemini is rate-limited (429) — it is not
 * a general fallback for session AI responses.
 */

// ── Local topic pool (used only on 429 rate-limit) ────────────────────────────
const TOPIC_POOL = {
  "Artificial Intelligence": [
    "Will large language models replace software engineers within the next decade?",
    "Should AI-generated content be required to carry a disclosure label?",
    "Is artificial general intelligence an existential risk or an overhyped concern?",
    "Bias in AI algorithms — whose responsibility is it to fix it?",
    "Can machine learning models ever be truly explainable and transparent?",
  ],
  "Cybersecurity": [
    "Zero-trust architecture — is it the only viable security model for modern enterprises?",
    "Should ethical hacking be a mandatory subject in computer science curricula?",
    "Is end-to-end encryption a right or a threat to national security?",
    "Quantum computing will make current encryption obsolete — how prepared are we?",
    "Should companies be legally liable for data breaches caused by negligence?",
  ],
  "Software Engineering": [
    "Is open-source software more secure than proprietary software?",
    "Should software engineers be licensed and regulated like civil engineers?",
    "Technical debt: the silent killer of software projects — how should teams manage it?",
    "Agile vs Waterfall — which methodology delivers better software in 2026?",
    "Is test-driven development practical in fast-paced startup environments?",
  ],
  "Cloud & Infrastructure": [
    "Cloud computing vs on-premise infrastructure — which is the future for enterprises?",
    "Multi-cloud strategy: smart risk management or unnecessary complexity?",
    "Edge computing will replace centralised cloud — agree or disagree?",
    "Should cloud providers be regulated as public utilities?",
    "Serverless computing — is it ready to power mission-critical applications?",
  ],
  "Data Science": [
    "Data privacy vs personalisation — where should the line be drawn?",
    "Should individuals own and monetise their personal data?",
    "Is big data analytics creating an unfair advantage for large corporations?",
    "Real-time data processing vs batch processing — which suits modern business needs?",
  ],
  "Emerging Technologies": [
    "Blockchain beyond cryptocurrency — is it solving real-world problems?",
    "The metaverse — transformative platform or expensive distraction?",
    "Internet of Things — are we creating a global surveillance infrastructure?",
    "Should brain-computer interfaces be regulated before they reach consumers?",
  ],
  "Tech Policy & Ethics": [
    "Should governments regulate artificial intelligence development?",
    "Big Tech monopolies — should companies like Google and Meta be broken up?",
    "Digital divide — is universal internet access a human right?",
    "Should social media platforms be held responsible for algorithmic radicalisation?",
    "Net neutrality — is an open internet still achievable in 2026?",
  ],
  "General Knowledge": [
    "Remote work in the tech industry — permanent shift or temporary trend?",
    "Should coding be a compulsory subject from primary school?",
    "Green technology — can innovation alone solve the climate crisis?",
    "The four-day workweek in tech companies — productivity myth or proven model?",
    "STEM education — are we producing enough talent to meet the demand?",
  ],
};

export const CATEGORIES = Object.keys(TOPIC_POOL);

let _catIdx = Math.floor(Math.random() * CATEGORIES.length);
function nextCategory() {
  const cat = CATEGORIES[_catIdx % CATEGORIES.length];
  _catIdx++;
  return cat;
}

export function getCategories() {
  return CATEGORIES;
}

// ── Local picker (no consecutive repeats per category) ────────────────────────
const _lastPicked = new Map();
function pickLocal(category) {
  const cat  = TOPIC_POOL[category] ? category : nextCategory();
  const pool = TOPIC_POOL[cat];
  const last = _lastPicked.get(cat) ?? -1;
  let idx;
  do { idx = Math.floor(Math.random() * pool.length); }
  while (idx === last && pool.length > 1);
  _lastPicked.set(cat, idx);
  return { topic: pool[idx], source: "local", category: cat };
}

// ── Gemini call ───────────────────────────────────────────────────────────────
function buildPrompt(category) {
  return (
    "Generate one concise, thought-provoking group discussion topic.\n" +
    "Rules:\n" +
    "- Single sentence or question, 10–25 words\n" +
    "- Suitable for a structured academic or professional debate\n" +
    "- Related to IT, technology, or general knowledge\n" +
    "- Return ONLY the topic text — no numbering, no quotes, no explanation\n\n" +
    `Category: ${category}`
  );
}

function cleanTopic(raw) {
  const t = raw.trim().replace(/^["'`*\-•\d.]+\s*|["'`*\-•]+$/g, "").trim();
  if (!t || t.length < 10) throw new Error("Response too short or empty");
  if (t.length > 300)      throw new Error("Response too long");
  return t;
}

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function callGemini(apiKey, category) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  "POST",
      signal:  controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(category) }] }],
        generationConfig: { maxOutputTokens: 80, temperature: 0.9 },
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const err = new Error(`Gemini HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const json = await res.json();
    const raw  = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return cleanTopic(raw);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * generateTopic — Gemini first, local pool on 429, error on other failures.
 */
export async function generateTopic(options = {}) {
  const category = options.category && CATEGORIES.includes(options.category)
    ? options.category
    : nextCategory();

  const apiKey = process.env.GEMINI_API_KEY;
  const hasKey = apiKey && apiKey.trim() !== "" && apiKey !== "your_gemini_api_key_here";

  if (hasKey) {
    try {
      const topic = await callGemini(apiKey, category);
      console.log(`[topics] ✦ Gemini [${category}]: "${topic.slice(0, 60)}…"`);
      return { topic, source: "gemini", category };
    } catch (err) {
      if (err.status === 429) {
        // Rate-limited — use local pool silently
        const result = pickLocal(category);
        console.warn(`[topics] Gemini 429 — using local pool: "${result.topic.slice(0, 60)}…"`);
        return result;
      }
      // Other error (network, 5xx) — also fall back to local so the app stays usable
      const result = pickLocal(category);
      console.warn(`[topics] Gemini failed (${err.message.slice(0, 60)}) — using local pool`);
      return result;
    }
  }

  // No API key — use local pool
  const result = pickLocal(category);
  console.log(`[topics] no key — local pool: "${result.topic.slice(0, 60)}…"`);
  return result;
}
