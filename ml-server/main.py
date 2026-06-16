"""
ml-server/main.py — FastAPI ML microservice entry point.

Architecture:
  Frontend → Node.js Backend (port 4000)
            → FastAPI ML Server (port 8000)  ← this service
            → ML Models (Whisper, CRNN, SBERT)

Start:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import sys

# Ensure imports resolve relative to this file's directory
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

# Make `ml_server` importable as a package alias for the `ml-server/` directory
import types as _types
_pkg = _types.ModuleType("ml_server")
_pkg.__path__ = [_HERE]
_pkg.__package__ = "ml_server"
sys.modules.setdefault("ml_server", _pkg)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ml_server.config.settings import (
    CORS_ORIGINS,
    HOST,
    PORT,
    SERVICE_NAME,
    SERVICE_VERSION,
    TEMP_DIR,
    TEMP_AUDIO_DIR,
    SEGMENTS_DIR,
    REPORTS_DIR,
    LOGS_DIR,
)
from ml_server.routes.analyze import router as analyze_router
from ml_server.routes.evaluate import router as evaluate_router
from ml_server.routes.generate import router as generate_router
from ml_server.routes.health import router as health_router
from ml_server.utils.logging_config import get_logger

log = get_logger(SERVICE_NAME)

# ── Ensure working directories exist ─────────────────────────────────────────
for d in (TEMP_DIR, TEMP_AUDIO_DIR, SEGMENTS_DIR, REPORTS_DIR, LOGS_DIR):
    os.makedirs(d, exist_ok=True)

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="IntelliBot ML Service",
    description="Machine Learning microservice for speech analysis, fluency scoring, and session evaluation.",
    version=SERVICE_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — only Node.js backend and development clients should call this service directly
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global error handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"error": str(exc)})

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(analyze_router)
app.include_router(evaluate_router)
app.include_router(generate_router)

# ── Legacy compatibility — old /api/fluency/* paths ───────────────────────────
# The Node.js backend currently proxies to /api/fluency/upload and /api/fluency/score.
# These aliases ensure a zero-downtime migration while Node is updated.
from ml_server.routes.analyze import analyze_audio, analyze_transcript  # noqa: E402
from ml_server.schemas.audio import TranscriptScoreRequest               # noqa: E402
from fastapi import File, UploadFile                                     # noqa: E402

@app.post("/api/fluency/upload", include_in_schema=False)
async def legacy_upload(audio: UploadFile = File(...)):
    return await analyze_audio(audio)

@app.post("/api/fluency/score", include_in_schema=False)
async def legacy_score(data: dict):
    req = TranscriptScoreRequest(
        transcript=data.get("transcript", ""),
        topic=data.get("topic", ""),
        prosody=data.get("prosody", {}),
    )
    return await analyze_transcript(req)

@app.get("/api/fluency/topic", include_in_schema=False)
async def legacy_topic():
    """Legacy topic generation — delegates to Gemini via utils."""
    from ml_server.utils.gemini_key import gemini_generate
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    _tp = ThreadPoolExecutor(max_workers=1)
    prompt = (
        "Generate one open-ended discussion topic related to technology or current affairs. "
        "Return the topic text only, no explanation, no quotes."
    )
    try:
        loop  = asyncio.get_event_loop()
        topic = await loop.run_in_executor(_tp, gemini_generate, prompt)
        topic = topic.strip().strip("'\"")
        if topic:
            return {"topic": topic}
        return {"error": "Empty topic returned."}
    except Exception as exc:
        return {"error": f"Topic generation failed: {exc}"}

log.info(
    "%s v%s — endpoints: /health /analyze/audio /analyze/transcript "
    "/evaluate/session /generate/report",
    SERVICE_NAME,
    SERVICE_VERSION,
)

# ── Dev runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True, log_level="info")
