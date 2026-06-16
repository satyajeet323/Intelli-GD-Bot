"""
config/settings.py — Centralised configuration for the ML microservice.
All secrets are sourced from environment variables — never hardcoded.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Service identity ──────────────────────────────────────────────────────────
SERVICE_NAME    = "intellibot-ml"
SERVICE_VERSION = "1.0.0"
HOST            = os.getenv("ML_HOST", "0.0.0.0")
PORT            = int(os.getenv("ML_PORT", "8000"))

# ── Node.js backend ───────────────────────────────────────────────────────────
NODE_SERVER_URL  = os.getenv("NODE_SERVER_URL", "http://localhost:4000")
INTERNAL_SECRET  = os.getenv("INTERNAL_SERVICE_SECRET") or os.getenv("JWT_SECRET", "")

# ── Gemini AI ─────────────────────────────────────────────────────────────────
GEMINI_MODEL        = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_KEY_TTL  = int(os.getenv("GEMINI_API_KEY_TTL", "30"))

# ── Audio / Whisper ───────────────────────────────────────────────────────────
WHISPER_MODEL       = os.getenv("WHISPER_MODEL", "tiny.en")
CHUNK_DURATION_SEC  = int(os.getenv("CHUNK_DURATION_SEC", "15"))
MIN_WORDS_FOR_SCORE = int(os.getenv("MIN_WORDS_FOR_SCORE", "50"))

# ── CRNN filler model ─────────────────────────────────────────────────────────
_HERE             = os.path.dirname(os.path.abspath(__file__))
ML_SERVER_ROOT    = os.path.dirname(_HERE)
FILLER_MODEL_PATH = os.getenv(
    "FILLER_MODEL_PATH",
    os.path.join(ML_SERVER_ROOT, "models", "filler_crnn_final.pth"),
)
CRNN_NUM_SEGMENTS = int(os.getenv("CRNN_NUM_SEGMENTS", "6"))

# ── Sentence-transformers ─────────────────────────────────────────────────────
SBERT_MODEL = os.getenv("SBERT_MODEL", "all-MiniLM-L6-v2")

# ── Working directories ───────────────────────────────────────────────────────
TEMP_DIR       = os.getenv("TEMP_DIR",       os.path.join(ML_SERVER_ROOT, "temp"))
TEMP_AUDIO_DIR = os.getenv("TEMP_AUDIO_DIR", os.path.join(ML_SERVER_ROOT, "temp_audio"))
SEGMENTS_DIR   = os.getenv("SEGMENTS_DIR",   os.path.join(ML_SERVER_ROOT, "segments_temp"))
REPORTS_DIR    = os.getenv("REPORTS_DIR",    os.path.join(ML_SERVER_ROOT, "reports"))
LOGS_DIR       = os.getenv("LOGS_DIR",       os.path.join(ML_SERVER_ROOT, "logs"))

# ── CORS ──────────────────────────────────────────────────────────────────────
# Server-to-server calls (Node → ML) don't send an Origin header, so CORS
# only matters for browser clients calling the ML service directly (dev/docs).
# In production the ML service should only be reachable from the Node backend.
_raw_origins = os.getenv(
    "ML_CORS_ORIGINS",
    "http://localhost:4000,http://localhost:5000,http://localhost:5173,http://localhost:5174,http://localhost:3000",
)
if _raw_origins.strip() == "*":
    CORS_ORIGINS = ["*"]
else:
    CORS_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ── HTTP timeouts (seconds) ───────────────────────────────────────────────────
HTTP_TIMEOUT_NODE   = int(os.getenv("HTTP_TIMEOUT_NODE", "5"))
HTTP_TIMEOUT_GEMINI = int(os.getenv("HTTP_TIMEOUT_GEMINI", "30"))

# ── Retry ────────────────────────────────────────────────────────────────────
RETRY_MAX_ATTEMPTS = int(os.getenv("RETRY_MAX_ATTEMPTS", "2"))
RETRY_BACKOFF_SEC  = float(os.getenv("RETRY_BACKOFF_SEC", "1.0"))
