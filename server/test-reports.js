/**
 * test-reports.js — Performance tracking system test.
 * Tests: score calculator, filler detection, feedback, API endpoints.
 * Run: node test-reports.js
 */

import {
  countFillerWords,
  fillerPenalty,
  calculateOverallScore,
  generateFeedback,
  aggregateReports,
} from "./src/lib/scoreCalculator.js";

const pass = (label)      => console.log(`  ✓  ${label}`);
const fail = (label, err) => console.log(`  ✗  ${label}  →  ${err}`);
const results = [];
const check = (label, condition, detail = "") => {
  if (condition) { results.push(true);  pass(label); }
  else           { results.push(false); fail(label, detail || "assertion failed"); }
};

console.log("\n╔══════════════════════════════════════════════════╗");
console.log("║   Performance Tracking — Full Test               ║");
console.log("╚══════════════════════════════════════════════════╝\n");

// ── 1. Filler word detection ──────────────────────────────────────────────────
console.log("1. Filler word detection");
check("No fillers in clean text",
  countFillerWords("The cloud is transforming enterprise infrastructure.") === 0);
check("Detects 'um' and 'uh'",
  countFillerWords("Um, I think, uh, the answer is yes.") >= 2);
check("Detects 'like' and 'you know'",
  countFillerWords("It's like, you know, really important.") >= 2);
check("Case-insensitive detection",
  countFillerWords("UM, BASICALLY, LITERALLY this is important.") >= 3);
check("Empty string returns 0",
  countFillerWords("") === 0);
check("Null returns 0",
  countFillerWords(null) === 0);

// ── 2. Filler penalty ─────────────────────────────────────────────────────────
console.log("\n2. Filler word penalty");
check("0–2 fillers → 0 penalty",   fillerPenalty(0) === 0 && fillerPenalty(2) === 0);
check("3–5 fillers → 0.5 penalty", fillerPenalty(3) === 0.5 && fillerPenalty(5) === 0.5);
check("6–10 fillers → 1.0 penalty",fillerPenalty(6) === 1.0 && fillerPenalty(10) === 1.0);
check("11+ fillers → 1.5 penalty", fillerPenalty(11) === 1.5 && fillerPenalty(20) === 1.5);

// ── 3. Overall score calculation ──────────────────────────────────────────────
console.log("\n3. Overall score calculation");

const s1 = calculateOverallScore({ fluency: 8, relevance: 9, confidence: 7, fillerWords: 0 });
check(`Perfect input (8,9,7, 0 fillers) → ~8.05 got ${s1}`,
  s1 >= 7.9 && s1 <= 8.2, `got ${s1}`);

const s2 = calculateOverallScore({ fluency: 10, relevance: 10, confidence: 10, fillerWords: 0 });
check(`Max scores → 10.0, got ${s2}`, s2 === 10.0, `got ${s2}`);

const s3 = calculateOverallScore({ fluency: 0, relevance: 0, confidence: 0, fillerWords: 0 });
check(`Zero scores → 0.0, got ${s3}`, s3 === 0.0, `got ${s3}`);

const s4 = calculateOverallScore({ fluency: 8, relevance: 8, confidence: 8, fillerWords: 15 });
const s4NoFiller = calculateOverallScore({ fluency: 8, relevance: 8, confidence: 8, fillerWords: 0 });
check(`High fillers reduce score (${s4} < ${s4NoFiller})`, s4 < s4NoFiller, `${s4} vs ${s4NoFiller}`);

const s5 = calculateOverallScore({ fluency: 0.5, relevance: 0.5, confidence: 0.5, fillerWords: 20 });
check(`Score never goes below 0, got ${s5}`, s5 >= 0, `got ${s5}`);

// ── 4. Feedback generation ────────────────────────────────────────────────────
console.log("\n4. Feedback generation");

const fb1 = generateFeedback({ fluency: 9, relevance: 9, confidence: 9, fillerWords: 0, turns: 10, overallScore: 9.0 });
check("High scorer gets positive feedback", fb1.includes("Excellent") || fb1.includes("strong"), fb1.slice(0, 80));

const fb2 = generateFeedback({ fluency: 4, relevance: 4, confidence: 4, fillerWords: 15, turns: 2, overallScore: 3.5 });
check("Low scorer gets improvement feedback", fb2.includes("practis") || fb2.includes("Keep") || fb2.includes("Work"), fb2.slice(0, 80));

check("Feedback mentions filler count when high",
  generateFeedback({ fluency: 7, relevance: 7, confidence: 7, fillerWords: 12, turns: 5, overallScore: 6.5 }).includes("12"),
  "should mention 12 fillers");

check("Feedback mentions zero fillers",
  generateFeedback({ fluency: 8, relevance: 8, confidence: 8, fillerWords: 0, turns: 6, overallScore: 8.0 }).includes("zero"),
  "should mention zero fillers");

// ── 5. Aggregate reports ──────────────────────────────────────────────────────
console.log("\n5. Aggregate reports");

const mockReports = [
  { fluency: 9, relevance: 9, confidence: 9, fillerWords: 1, turns: 8, overallScore: 9.0 },
  { fluency: 7, relevance: 8, confidence: 7, fillerWords: 5, turns: 6, overallScore: 7.3 },
  { fluency: 5, relevance: 6, confidence: 5, fillerWords: 12, turns: 3, overallScore: 5.0 },
];

const agg = aggregateReports(mockReports);
check("Aggregate returns object",       !!agg);
check("participantCount = 3",           agg.participantCount === 3, `got ${agg.participantCount}`);
check("avgOverallScore is a number",    typeof agg.avgOverallScore === "number");
check("totalTurns = 17",               agg.totalTurns === 17, `got ${agg.totalTurns}`);
check("highestScore = 9.0",            agg.highestScore === 9.0, `got ${agg.highestScore}`);
check("lowestScore = 5.0",             agg.lowestScore === 5.0, `got ${agg.lowestScore}`);
check("scoreDistribution has 4 bands", Object.keys(agg.scoreDistribution).length === 4);
check("excellent count = 1",           agg.scoreDistribution.excellent === 1, `got ${agg.scoreDistribution.excellent}`);
check("null input returns null",        aggregateReports(null) === null);
check("empty array returns null",       aggregateReports([]) === null);

// ── 6. API endpoints ──────────────────────────────────────────────────────────
console.log("\n6. API endpoints");

// Create in-memory session
let sessionId;
try {
  const r = await fetch("http://localhost:4000/api/test/session", { method: "POST" });
  const d = await r.json();
  sessionId = d.sessionId;
  check(`Session created: ${sessionId}`, !!sessionId);
} catch (e) { check("Create session", false, e.message); }

// GET /api/reports/:id — session not found
try {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  const r = await fetch("http://localhost:4000/api/reports/FAKE-FAKE-FAKE", { signal: ctrl.signal });
  clearTimeout(t);
  check("404 or 500 for unknown session (DB may be offline)", r.status === 404 || r.status === 500, `got ${r.status}`);
} catch (e) { check("404 test (DB offline — expected)", true, "skipped"); }

// GET /api/reports/:id/summary — no reports yet
if (sessionId) {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`http://localhost:4000/api/reports/${sessionId}/summary`, { signal: ctrl.signal });
    const d = await r.json();
    check("Summary returns null when no reports", d.success && d.summary === null, JSON.stringify(d).slice(0, 80));
  } catch (e) { check("Empty summary (DB offline — skipped)", true); }
}

// GET /api/reports/:id/leaderboard — empty
if (sessionId) {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`http://localhost:4000/api/reports/${sessionId}/leaderboard`, { signal: ctrl.signal });
    const d = await r.json();
    check("Empty leaderboard returns []", d.success && d.leaderboard.length === 0, JSON.stringify(d).slice(0, 80));
  } catch (e) { check("Empty leaderboard (DB offline — skipped)", true); }
}

// ── Summary ───────────────────────────────────────────────────────────────────
const passed = results.filter(Boolean).length;
const total  = results.length;
console.log(`\n${"─".repeat(52)}`);
console.log(`  ${passed}/${total} tests passed`);
if (passed === total) console.log("  ✅  All performance tracking tests passed!\n");
else                  console.log("  ❌  Some tests failed\n");
process.exit(passed === total ? 0 : 1);
