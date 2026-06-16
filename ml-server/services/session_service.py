"""
services/session_service.py — AI session transcript evaluation.

Delegates end-of-session ML-powered report generation.
Node server still owns conversation turn management (Groq/Gemini calls).
"""

import asyncio
import json
import re
from concurrent.futures import ThreadPoolExecutor
import logging

from ml_server.utils.gemini_key import gemini_generate

log   = logging.getLogger("ml.session")
_pool = ThreadPoolExecutor(max_workers=2)


_ANALYSIS_TEMPLATE = """You are an expert communication coach evaluating a real professional group discussion.

Topic: "{topic}"
User spoke {turns} turn(s), {word_count} total words, ~{avg_wpt} words per turn.

Full Transcript (You = user, AI = discussion partner):
{transcript}

Analyse ONLY the "You:" lines. Base every score and comment strictly on what the user actually said.

Return ONLY this valid JSON (no markdown):
{{
  "overallScore": <int 1-10>,
  "summary": "<2-3 sentences on this user's discussion>",
  "strengths": ["<specific strength>", "<another>", "<third>"],
  "weaknesses": ["<specific weakness>", "<another>"],
  "grammarSuggestions": ["<quote + correction>", "<another>"],
  "contextualRelevance": "<how closely user argued the topic>",
  "communicationFeedback": "<detailed paragraph referencing specific things user said>",
  "improvements": ["<actionable improvement>", "<second>", "<third>"],
  "vocabularyScore": <int 1-10>,
  "clarityScore": <int 1-10>,
  "engagementScore": <int 1-10>
}}"""

_RETRY_TEMPLATE = """Evaluate this discussion transcript for the topic "{topic}".
User turns only:
{user_turns}

Return ONLY this JSON (integers 1-10, no markdown):
{{"overallScore":0,"summary":"","strengths":[],"weaknesses":[],"grammarSuggestions":[],"contextualRelevance":"","communicationFeedback":"","improvements":[],"vocabularyScore":0,"clarityScore":0,"engagementScore":0}}"""


def _parse_json(raw: str) -> dict:
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(cleaned)


def evaluate_session_sync(
    topic: str,
    history: list[dict],
    duration_seconds: int = 0,
) -> dict:
    """Run end-of-session analysis, returns the full report dict."""
    full_transcript = "\n\n".join(
        f"{'You' if m['role'] == 'user' else 'AI'}: {m['content']}"
        for m in history
    )
    user_msgs  = [m for m in history if m["role"] == "user"]
    turns      = len(user_msgs)
    user_text  = " ".join(m["content"] for m in user_msgs)
    word_count = len(user_text.strip().split())
    avg_wpt    = round(word_count / turns) if turns > 0 else 0

    analysis = None

    # Attempt 1 — rich prompt
    try:
        prompt = _ANALYSIS_TEMPLATE.format(
            topic=topic, turns=turns, word_count=word_count,
            avg_wpt=avg_wpt, transcript=full_transcript,
        )
        raw      = gemini_generate(prompt).strip()
        analysis = _parse_json(raw)
    except Exception as e1:
        log.warning("Session analysis attempt 1 failed: %s", e1)
        # Attempt 2 — simplified prompt
        try:
            user_lines = "\n".join(
                f"Turn {i+1}: {m['content']}"
                for i, m in enumerate(user_msgs)
            )
            prompt2  = _RETRY_TEMPLATE.format(topic=topic, user_turns=user_lines)
            raw2     = gemini_generate(prompt2).strip()
            analysis = _parse_json(raw2)
        except Exception as e2:
            log.error("Session analysis attempt 2 failed: %s", e2)
            raise RuntimeError("AI analysis service temporarily unavailable.") from e2

    minutes = (duration_seconds or 0) // 60
    secs    = (duration_seconds or 0) %  60
    from datetime import datetime, timezone
    return {
        "topic":       topic,
        "duration":    f"{minutes}m {secs}s",
        "turns":       turns,
        "transcript":  full_transcript,
        "analysis":    analysis,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


async def evaluate_session_async(
    topic: str,
    history: list[dict],
    duration_seconds: int = 0,
) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _pool, evaluate_session_sync, topic, history, duration_seconds
    )
