"""
routes/generate.py — Report generation endpoint.

POST /generate/report — Calculate GD overall score + generate feedback
"""

import logging
from fastapi import APIRouter, HTTPException

from ml_server.schemas.session import GenerateReportRequest, GenerateReportResponse
from ml_server.services.scoring_service import calculate_overall_score, generate_feedback

log    = logging.getLogger("ml.routes.generate")
router = APIRouter(prefix="/generate", tags=["generate"])


@router.post("/report", response_model=GenerateReportResponse)
async def generate_report(req: GenerateReportRequest):
    """
    Calculate the overall performance score and generate feedback text
    for a group-discussion participant report.
    """
    try:
        overall = calculate_overall_score(
            fluency=req.fluency,
            relevance=req.relevance,
            confidence=req.confidence,
            filler_words=req.filler_words,
        )
        feedback = generate_feedback(
            fluency=req.fluency,
            relevance=req.relevance,
            confidence=req.confidence,
            filler_words=req.filler_words,
            turns=req.turns,
            overall_score=overall,
        )
    except Exception as exc:
        log.exception("Report generation failed")
        raise HTTPException(500, f"Report generation failed: {exc}") from exc

    return {
        "overall_score": overall,
        "feedback":      feedback,
        "metrics": {
            "fluency":     req.fluency,
            "relevance":   req.relevance,
            "confidence":  req.confidence,
            "fillerWords": req.filler_words,
            "turns":       req.turns,
        },
    }
