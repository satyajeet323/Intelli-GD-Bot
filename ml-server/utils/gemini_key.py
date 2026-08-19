"""
utils/gemini_key.py — Dynamic Gemini API key resolution.

Tries to fetch the active key from the Node.js admin API (cached for TTL seconds).
Falls back to GEMINI_API_KEY env var if Node is unavailable.

Resolves config from env directly to avoid bootstrap ordering issues.
"""

import os
import time
import threading
import requests

# Read config directly from env — no ml_server.config import needed here
_NODE_URL     = os.getenv("NODE_SERVER_URL", "http://localhost:4000")
_INT_SECRET   = os.getenv("INTERNAL_SERVICE_SECRET") or os.getenv("JWT_SECRET", "")
_CACHE_TTL    = int(os.getenv("GEMINI_API_KEY_TTL", "30"))
_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.7-flash")

_lock:   threading.Lock = threading.Lock()
_cached: dict           = {"value": None, "ts": 0.0}


def _fetch_from_node() -> str | None:
    try:
        resp = requests.get(
            f"{_NODE_URL}/api/admin/api-keys/internal/active-key/gemini",
            headers={"x-internal-secret": _INT_SECRET},
            timeout=3,
        )
        if resp.status_code == 200:
            return resp.json().get("value")
    except Exception:
        pass
    return None


def get_gemini_key() -> str | None:
    """Return the current active Gemini key, cached for _CACHE_TTL seconds."""
    with _lock:
        now = time.time()
        if _cached["value"] and (now - _cached["ts"]) < _CACHE_TTL:
            return _cached["value"]
        key = _fetch_from_node() or os.getenv("GEMINI_API_KEY")
        if key:
            _cached["value"] = key
            _cached["ts"]    = now
        return key


def get_gemini_client():
    """Return a configured google.genai client, raising if no key available."""
    from google import genai
    key = get_gemini_key()
    if not key:
        raise ValueError(
            "No active Gemini API key. Configure one via Admin Panel → API Keys."
        )
    return genai.Client(api_key=key)


def gemini_generate(prompt: str) -> str:
    """Single-shot text generation via Gemini using new Interactions API."""
    from google import genai
    key = get_gemini_key()
    if not key:
        raise ValueError("No active Gemini API key.")
    
    client = genai.Client(api_key=key)
    interaction = client.interactions.create(
        model=_GEMINI_MODEL,
        input=prompt
    )
    return interaction.output_text
