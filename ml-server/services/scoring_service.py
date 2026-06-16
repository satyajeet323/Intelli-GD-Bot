"""
services/scoring_service.py — Fluency scoring via Gemini + semantic relevance.
"""

import asyncio
import json
import re
from concurrent.futures import ThreadPoolExecutor
import logging

from ml_server.models.semantic_model import compute_relevance
from ml_server.utils.gemini_key import gemini_generate

log   = logging.getLogger("ml.scoring")
_pool = ThreadPoolExecutor(max_workers=2)

# ── GD score weights (mirrors scoreCalculator.js) ─────────────────────────────
_FLUENCY_WEIGHT    = 0.35
_RELEVANCE_WEIGHT  = 0.35
_CONFIDENCE_WEIGHT = 0.30


def _filler_penalty(count: int) -> float:
    if count <= 2:  return 0.0
    if count <= 5:  return 0.5
    if count <= 10: return 1.0
    return 1.5


def _clamp(v: float, lo: float = 0.0, hi: float = 10.0) -> float:
    return round(max(lo, min(hi, v)), 2)


# ── Public: GD overall score ───────────────────────────────────────────────────
def calculate_overall_score(
    fluency: float,
    relevance: float,
    confidence: float,
    filler_words: int = 0,
) -> float:
    adj_fluency = _clamp(fluency - _filler_penalty(filler_words))
    return _clamp(
        adj_fluency * _FLUENCY_WEIGHT
        + relevance  * _RELEVANCE_WEIGHT
        + confidence * _CONFIDENCE_WEIGHT
    )


def generate_feedback(
    fluency: float,
    relevance: float,
    confidence: float,
    filler_words: int,
    turns: int,
    overall_score: float,
) -> str:
    lines: list[str] = []
    if overall_score >= 8.5:     lines.append("Excellent performance — strong command of the topic.")
    elif overall_score >= 7.0:   lines.append("Good performance with clear, structured arguments.")
    elif overall_score >= 5.5:   lines.append("Decent effort — there is room to improve delivery and depth.")
    else:                        lines.append("Keep practising — focus on structure and staying on topic.")
    if fluency >= 8:             lines.append("Speech was smooth and well-paced.")
    elif fluency >= 6:           lines.append("Fluency was acceptable but could be more natural.")
    else:                        lines.append("Work on speaking more fluidly.")
    if filler_words == 0:        lines.append("Impressive — zero filler words detected.")
    elif filler_words <= 3:      lines.append(f"Only {filler_words} filler word(s) — very good control.")
    elif filler_words <= 7:      lines.append(f"{filler_words} filler words — try to reduce them.")
    else:                        lines.append(f"{filler_words} filler words is high — practise pausing instead.")
    if relevance >= 8:           lines.append("Responses were highly relevant to the topic.")
    elif relevance >= 6:         lines.append("Most responses were on-topic — stay more focused.")
    else:                        lines.append("Keep arguments more closely tied to the discussion topic.")
    if confidence >= 8:          lines.append("Spoke with strong confidence and conviction.")
    elif confidence >= 6:        lines.append("Confidence was moderate — assert your points more clearly.")
    else:                        lines.append("Work on projecting more confidence.")
    if turns >= 8:               lines.append(f"Active participation with {turns} turns.")
    elif turns >= 4:             lines.append(f"You took {turns} turns — contribute more frequently.")
    else:                        lines.append(f"Only {turns} turn(s) — aim to participate more actively.")
    return " ".join(lines)


# ── Public: Gemini-based fluency scoring ──────────────────────────────────────
_SCORING_PROMPT_TEMPLATE = """
You are a STANDARDS-DRIVEN English speaking evaluator. Follow the rules exactly.

1) Input:
- Topic: "{topic}"
- Transcript: "{short_transcript}"
- Prosody JSON: {prosody_json}

2) Language scoring rubric (strict numeric thresholds):
A) Vocabulary (TTR): <0.25→2, 0.25-0.40→5, 0.40-0.55→8, ≥0.55→10
B) Grammar (errors/100w): ≥6→2, 4-5→5, 2-3→8, 0-1→10
C) Sentence Correctness (%complete): <60%→2, 60-74%→5, 75-89%→8, ≥90%→10
D) Coherence (cosine sim): <0.45→2, 0.45-0.59→5, 0.60-0.74→8, ≥0.75→10
E) Clarity (FK Reading Ease): <30→2, 30-49→5, 50-59→8, ≥60→10

3) Prosody scoring (from Prosody JSON):
A) speech_rate_score: ≤60→1, 61-80→2, 81-100→4, 101-120→6, 121-140→8, 141-160→9, 161-180→8, 181-200→5, >200→2
B) pause_time_score (pause_ratio): ≥0.40→1, 0.30-0.39→2, 0.20-0.29→4, 0.12-0.19→6, 0.07-0.11→8, 0.04-0.06→9, <0.04→7
C) pitch_variability_score (pitch_stability): <0.01→2, 0.01-0.02→4, 0.02-0.035→7, 0.035-0.06→9, 0.06-0.10→6, >0.10→3
D) rhythm_variability_score (nPVI): <10→2, 10-25→4, 25-50→8, 51-70→6, >70→3
E) fillers_score: 0→10, 1→9, 2→7, 3→5, 4→3, 5→2, 6→0

4) Reply ONLY with valid JSON (no markdown, no commentary):
{{
  "vocabulary_score": int,
  "grammar_score": int,
  "sentence_correctness_score": int,
  "coherence_score": int,
  "clarity_score": int,
  "relevance_score": int,
  "grammatical_mistake": string,
  "improvement_needed": string,
  "speech_rate_score": int,
  "pause_time_score": int,
  "pitch_variability_score": int,
  "rhythm_variability_score": int,
  "fillers_score": int
}}
"""


def _build_scoring_prompt(topic: str, transcript: str, prosody: dict) -> str:
    sentences = re.split(r"(?<=[.?!])\s+", transcript)
    short     = " ".join(
        sentences[:3] + sentences[-3:] if len(sentences) > 6 else sentences
    )
    return _SCORING_PROMPT_TEMPLATE.format(
        topic=topic,
        short_transcript=short,
        prosody_json=json.dumps(prosody, ensure_ascii=False),
    )


def score_transcript_sync(topic: str, transcript: str, prosody: dict) -> dict:
    """Compute semantic relevance + Gemini-based fluency scores."""
    relevance_score            = compute_relevance(topic, transcript)
    prosody["relevance_score"] = relevance_score

    prompt = _build_scoring_prompt(topic, transcript, prosody)
    raw    = gemini_generate(prompt).strip()

    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        raise ValueError(f"No JSON in Gemini response: {raw[:200]}")

    result = json.loads(m.group(0))
    return result


async def score_transcript_async(topic: str, transcript: str, prosody: dict) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _pool, score_transcript_sync, topic, transcript, prosody
    )
