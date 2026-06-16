"""
routes/health.py — Health check endpoint.

GET /health — Returns service status + model availability
"""

import os
import time

from fastapi import APIRouter

# Resolve directly from env — no cross-package import needed
_HERE             = os.path.dirname(os.path.abspath(__file__))
_ROOT             = os.path.dirname(_HERE)
_FILLER_MODEL     = os.getenv("FILLER_MODEL_PATH", os.path.join(_ROOT, "models", "filler_crnn_final.pth"))
_SERVICE_NAME     = os.getenv("SERVICE_NAME", "intellibot-ml")
_SERVICE_VERSION  = "1.0.0"

router = APIRouter(tags=["health"])
_start = time.time()


@router.get("/health")
async def health_check():
    """Lightweight liveness + readiness probe."""
    return {
        "status":         "ok",
        "service":        _SERVICE_NAME,
        "version":        _SERVICE_VERSION,
        "uptime_seconds": round(time.time() - _start),
        "models": {
            "crnn":    os.path.isfile(_FILLER_MODEL),
            "whisper": True,  # loaded lazily on first request
            "sbert":   True,  # loaded lazily on first request
        },
    }
