"""
routes/evaluate.py — Session evaluation endpoint.

POST /evaluate/session — Run end-of-session AI analysis on a conversation transcript
"""

import logging
from fastapi import APIRouter, HTTPException

from ml_server.schemas.session import EvaluateSessionRequest, EvaluateSessionResponse
from ml_server.services.session_service import evaluate_session_async

log    = logging.getLogger("ml.routes.evaluate")
router = APIRouter(prefix="/evaluate", tags=["evaluate"])


@router.post("/session", response_model=EvaluateSessionResponse)
async def evaluate_session(req: EvaluateSessionRequest):
    """
    Evaluate a completed AI session conversation.
    Expects topic + full message history.
    Returns a structured analysis report.
    """
    user_turns = [m for m in req.history if m.role == "user"]
    if not user_turns:
        raise HTTPException(400, "No user messages found in history.")

    try:
        report = await evaluate_session_async(
            topic=req.topic,
            history=[m.model_dump() for m in req.history],
            duration_seconds=req.duration_seconds or 0,
        )
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:
        log.exception("Session evaluation failed")
        raise HTTPException(500, f"Evaluation failed: {exc}") from exc

    return {"report": report}
