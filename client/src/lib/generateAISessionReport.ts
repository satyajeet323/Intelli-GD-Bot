/**
 * generateAISessionReport — Builds a downloadable HTML report for an AI Session.
 */

import type { SessionReport } from "./useAISession";

function scoreColor(score: number): string {
  if (score >= 8) return "#22c55e";
  if (score >= 6) return "#f59e0b";
  return "#ef4444";
}

function scoreBar(score: number): string {
  const pct = (score / 10) * 100;
  const color = scoreColor(score);
  return `<div style="background:#1e1e1e;border-radius:4px;height:8px;overflow:hidden;margin-top:4px">
    <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width 0.6s"></div>
  </div>`;
}

function listItems(items: string[]): string {
  return items.map((i) => `<li style="margin-bottom:6px">${i}</li>`).join("");
}

export function generateAISessionReportHTML(report: SessionReport): string {
  const { topic, duration, turns, transcript, analysis, generatedAt } = report;
  const date = new Date(generatedAt).toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Session Report — ${topic.slice(0, 60)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 40px 20px; }
    .container { max-width: 860px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1a1a1a, #111); border: 1px solid #2a2a2a; border-radius: 16px; padding: 32px; margin-bottom: 24px; }
    .badge { display: inline-block; background: #1e1e1e; border: 1px solid #333; border-radius: 20px; padding: 4px 12px; font-size: 11px; color: #888; margin-bottom: 12px; }
    h1 { font-size: 22px; font-weight: 700; color: #fff; line-height: 1.4; margin-bottom: 16px; }
    .meta { display: flex; gap: 24px; flex-wrap: wrap; }
    .meta-item { font-size: 13px; color: #888; }
    .meta-item span { color: #ccc; font-weight: 600; }
    .section { background: #111; border: 1px solid #1e1e1e; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 16px; }
    .scores-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }
    .score-card { background: #1a1a1a; border-radius: 10px; padding: 16px; }
    .score-label { font-size: 12px; color: #888; margin-bottom: 4px; }
    .score-value { font-size: 28px; font-weight: 700; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 20px; padding: 4px 12px; font-size: 12px; color: #ccc; }
    .tag.green { border-color: #166534; color: #86efac; background: #052e16; }
    .tag.red { border-color: #7f1d1d; color: #fca5a5; background: #2d0a0a; }
    .tag.yellow { border-color: #78350f; color: #fcd34d; background: #1c0f00; }
    ul { padding-left: 20px; color: #ccc; font-size: 14px; line-height: 1.7; }
    p { font-size: 14px; color: #ccc; line-height: 1.7; }
    .transcript { background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 10px; padding: 20px; font-family: monospace; font-size: 13px; line-height: 1.8; color: #aaa; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
    .transcript .user-line { color: #93c5fd; }
    .transcript .ai-line { color: #86efac; }
    .footer { text-align: center; font-size: 12px; color: #444; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">AI Session Report</div>
      <h1>${topic}</h1>
      <div class="meta">
        <div class="meta-item">Duration: <span>${duration}</span></div>
        <div class="meta-item">Turns: <span>${turns}</span></div>
        <div class="meta-item">Generated: <span>${date}</span></div>
      </div>
    </div>

    <!-- Scores -->
    <div class="section">
      <div class="section-title">Performance Scores</div>
      <div class="scores-grid">
        <div class="score-card">
          <div class="score-label">Overall</div>
          <div class="score-value" style="color:${scoreColor(analysis.overallScore)}">${analysis.overallScore}/10</div>
          ${scoreBar(analysis.overallScore)}
        </div>
        <div class="score-card">
          <div class="score-label">Vocabulary</div>
          <div class="score-value" style="color:${scoreColor(analysis.vocabularyScore)}">${analysis.vocabularyScore}/10</div>
          ${scoreBar(analysis.vocabularyScore)}
        </div>
        <div class="score-card">
          <div class="score-label">Clarity</div>
          <div class="score-value" style="color:${scoreColor(analysis.clarityScore)}">${analysis.clarityScore}/10</div>
          ${scoreBar(analysis.clarityScore)}
        </div>
        <div class="score-card">
          <div class="score-label">Engagement</div>
          <div class="score-value" style="color:${scoreColor(analysis.engagementScore)}">${analysis.engagementScore}/10</div>
          ${scoreBar(analysis.engagementScore)}
        </div>
      </div>
    </div>

    <!-- Summary -->
    <div class="section">
      <div class="section-title">Discussion Summary</div>
      <p>${analysis.summary}</p>
    </div>

    <!-- Communication Feedback -->
    <div class="section">
      <div class="section-title">Communication Feedback</div>
      <p>${analysis.communicationFeedback}</p>
    </div>

    <!-- Contextual Relevance -->
    <div class="section">
      <div class="section-title">Contextual Relevance</div>
      <p>${analysis.contextualRelevance}</p>
    </div>

    <!-- Strengths & Weaknesses -->
    <div class="section">
      <div class="section-title">Strengths</div>
      <div class="tag-list">
        ${analysis.strengths.map((s) => `<span class="tag green">${s}</span>`).join("")}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Areas for Improvement</div>
      <div class="tag-list">
        ${analysis.weaknesses.map((w) => `<span class="tag red">${w}</span>`).join("")}
      </div>
    </div>

    <!-- Grammar Suggestions -->
    <div class="section">
      <div class="section-title">Grammar & Language Suggestions</div>
      <ul>${listItems(analysis.grammarSuggestions)}</ul>
    </div>

    <!-- Improvement Recommendations -->
    <div class="section">
      <div class="section-title">Recommendations</div>
      <ul>${listItems(analysis.improvements)}</ul>
    </div>

    <!-- Full Transcript -->
    <div class="section">
      <div class="section-title">Full Transcript</div>
      <div class="transcript">${transcript
        .split("\n\n")
        .map((line) => {
          if (line.startsWith("You:")) return `<span class="user-line">${line}</span>`;
          if (line.startsWith("AI:")) return `<span class="ai-line">${line}</span>`;
          return line;
        })
        .join("\n\n")}</div>
    </div>

    <div class="footer">Generated by INTELLI BOT AI Session · ${date}</div>
  </div>
</body>
</html>`;
}

export function downloadReport(report: SessionReport): void {
  const html = generateAISessionReportHTML(report);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-session-report-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
