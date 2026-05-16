/**
 * scoreCalculator.js — Performance metric calculation engine.
 *
 * All scores are on a 0–10 scale.
 *
 * Scoring model:
 *
 *  fluency     — how smoothly the user speaks (penalised by filler words)
 *  relevance   — how on-topic the responses are
 *  confidence  — assertiveness and clarity of expression
 *  fillerWords — raw count (lower is better; used to penalise fluency)
 *  turns       — number of speaking turns taken
 *  overallScore — weighted average: fluency×35% + relevance×35% + confidence×30%
 *
 * Filler word penalty:
 *   0–2  fillers → no penalty
 *   3–5  fillers → −0.5
 *   6–10 fillers → −1.0
 *   11+  fillers → −1.5  (capped so score never goes below 0)
 */

// ── Filler word list ──────────────────────────────────────────────────────────
export const FILLER_WORDS = [
  "um", "uh", "er", "ah", "like", "you know", "i mean",
  "basically", "literally", "actually", "honestly", "right",
  "so", "well", "kind of", "sort of", "you see",
];

/**
 * Count filler words in a text string.
 * @param {string} text
 * @returns {number}
 */
export function countFillerWords(text) {
  if (!text || typeof text !== "string") return 0;
  const lower = text.toLowerCase();
  let count = 0;
  for (const filler of FILLER_WORDS) {
    // Match whole words / phrases
    const regex = new RegExp(`\\b${filler.replace(/\s+/g, "\\s+")}\\b`, "gi");
    const matches = lower.match(regex);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Calculate filler-word penalty (subtracted from fluency).
 * @param {number} fillerCount
 * @returns {number} penalty (0, 0.5, 1.0, or 1.5)
 */
export function fillerPenalty(fillerCount) {
  if (fillerCount <= 2)  return 0;
  if (fillerCount <= 5)  return 0.5;
  if (fillerCount <= 10) return 1.0;
  return 1.5;
}

/**
 * Clamp a value between min and max, rounded to 2 decimal places.
 */
export function clamp(value, min = 0, max = 10) {
  return parseFloat(Math.min(max, Math.max(min, value)).toFixed(2));
}

/**
 * Calculate the overall score from individual metrics.
 *
 * Weights: fluency 35%, relevance 35%, confidence 30%
 * Filler words penalise the fluency component.
 *
 * @param {{ fluency, relevance, confidence, fillerWords }} metrics
 * @returns {number} overallScore 0–10
 */
export function calculateOverallScore({ fluency, relevance, confidence, fillerWords = 0 }) {
  const penalty       = fillerPenalty(fillerWords);
  const adjFluency    = clamp(fluency - penalty);
  const overall       = (adjFluency * 0.35) + (relevance * 0.35) + (confidence * 0.30);
  return clamp(overall);
}

/**
 * Generate a text feedback string based on scores.
 *
 * @param {{ fluency, relevance, confidence, fillerWords, turns, overallScore }} metrics
 * @returns {string}
 */
export function generateFeedback({ fluency, relevance, confidence, fillerWords, turns, overallScore }) {
  const lines = [];

  // Overall
  if (overallScore >= 8.5)      lines.push("Excellent performance — you demonstrated strong command of the topic.");
  else if (overallScore >= 7.0) lines.push("Good performance with clear, structured arguments.");
  else if (overallScore >= 5.5) lines.push("Decent effort — there is room to improve your delivery and depth.");
  else                          lines.push("Keep practising — focus on structure and staying on topic.");

  // Fluency
  if (fluency >= 8)       lines.push("Your speech was smooth and well-paced.");
  else if (fluency >= 6)  lines.push("Fluency was acceptable but could be more natural.");
  else                    lines.push("Work on speaking more fluidly — avoid long pauses.");

  // Filler words
  if (fillerWords === 0)       lines.push("Impressive — zero filler words detected.");
  else if (fillerWords <= 3)   lines.push(`Only ${fillerWords} filler word(s) — very good control.`);
  else if (fillerWords <= 7)   lines.push(`${fillerWords} filler words detected — try to reduce them for a more polished delivery.`);
  else                         lines.push(`${fillerWords} filler words is high — practise pausing instead of using fillers.`);

  // Relevance
  if (relevance >= 8)      lines.push("Your responses were highly relevant to the topic.");
  else if (relevance >= 6) lines.push("Most responses were on-topic — stay more focused.");
  else                     lines.push("Try to keep your arguments more closely tied to the discussion topic.");

  // Confidence
  if (confidence >= 8)      lines.push("You spoke with strong confidence and conviction.");
  else if (confidence >= 6) lines.push("Confidence was moderate — assert your points more clearly.");
  else                      lines.push("Work on projecting more confidence when making your arguments.");

  // Turns
  if (turns >= 8)      lines.push(`Active participation with ${turns} turns — great engagement.`);
  else if (turns >= 4) lines.push(`You took ${turns} turns — try to contribute more frequently.`);
  else                 lines.push(`Only ${turns} turn(s) — aim to participate more actively.`);

  return lines.join(" ");
}

/**
 * Calculate aggregate statistics across multiple participant reports.
 *
 * @param {Array<{ fluency, relevance, confidence, fillerWords, turns, overallScore }>} reports
 * @returns {object} aggregated stats
 */
export function aggregateReports(reports) {
  if (!reports || reports.length === 0) return null;

  const valid = reports.filter((r) => r && typeof r.overallScore === "number");
  if (!valid.length) return null;

  const avg = (key) =>
    parseFloat((valid.reduce((s, r) => s + (r[key] ?? 0), 0) / valid.length).toFixed(2));

  const best = valid.reduce((a, b) => (a.overallScore >= b.overallScore ? a : b));
  const worst = valid.reduce((a, b) => (a.overallScore <= b.overallScore ? a : b));

  return {
    participantCount: valid.length,
    avgFluency:       avg("fluency"),
    avgRelevance:     avg("relevance"),
    avgConfidence:    avg("confidence"),
    avgFillerWords:   avg("fillerWords"),
    avgOverallScore:  avg("overallScore"),
    totalTurns:       valid.reduce((s, r) => s + (r.turns ?? 0), 0),
    highestScore:     parseFloat(best.overallScore.toFixed(2)),
    lowestScore:      parseFloat(worst.overallScore.toFixed(2)),
    scoreDistribution: {
      excellent: valid.filter((r) => r.overallScore >= 8.5).length,
      good:      valid.filter((r) => r.overallScore >= 7.0 && r.overallScore < 8.5).length,
      average:   valid.filter((r) => r.overallScore >= 5.5 && r.overallScore < 7.0).length,
      needsWork: valid.filter((r) => r.overallScore < 5.5).length,
    },
  };
}
