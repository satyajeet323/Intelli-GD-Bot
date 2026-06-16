"""
models/semantic_model.py — Topic relevance scoring with sentence-transformers.

Moved from server/Semantic.py.
"""

import logging
import os

import nltk
import numpy as np
from sentence_transformers import SentenceTransformer, util

log         = logging.getLogger("ml.semantic")
_SBERT_NAME = os.getenv("SBERT_MODEL", "all-MiniLM-L6-v2")

# Download NLTK data once — safe no-op if already present
nltk.download("punkt",     quiet=True)
nltk.download("punkt_tab", quiet=True)
from nltk.tokenize import sent_tokenize  # noqa: E402

_sbert: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _sbert
    if _sbert is None:
        _sbert = SentenceTransformer(_SBERT_NAME)
        log.info("SBERT loaded: %s", _SBERT_NAME)
    return _sbert


def compute_relevance(topic: str, transcript: str) -> int:
    """Return topic-relevance score 1–10."""
    transcript = transcript.strip().lower()
    sentences  = sent_tokenize(transcript)
    if not sentences:
        return 1

    model  = _get_model()
    t_emb  = model.encode(topic,     convert_to_tensor=True)
    s_embs = model.encode(sentences, convert_to_tensor=True)
    sims   = util.cos_sim(s_embs, t_emb).cpu().numpy().flatten()

    pct  = (sum(s >= 0.50 for s in sims) / len(sentences)) * 100
    if pct >= 85:   prop = 10
    elif pct >= 71: prop = 9
    elif pct >= 51: prop = 7
    elif pct >= 31: prop = 5
    elif pct >= 11: prop = 3
    else:           prop = 1

    avg   = round(float(sims.mean()) * 10)
    final = max(1, min(10, round((prop + avg) / 2)))
    log.debug("Relevance: score=%d  pct=%.1f%%", final, pct)
    return final
