"""schemas/session.py — Request/response models for session evaluation."""

from typing import Any
from pydantic import BaseModel, Field


class SessionMessage(BaseModel):
    role:    str = Field(..., description="'user' or 'assistant'")
    content: str


class EvaluateSessionRequest(BaseModel):
    topic:           str                  = Field(..., min_length=1)
    history:         list[SessionMessage] = Field(..., min_items=1)
    duration_seconds: int | None         = Field(None, ge=0)


class EvaluateSessionResponse(BaseModel):
    report: dict[str, Any]


class GenerateReportRequest(BaseModel):
    """Evaluate a group-discussion participant report."""
    fluency:     float = Field(..., ge=0, le=10)
    relevance:   float = Field(..., ge=0, le=10)
    confidence:  float = Field(..., ge=0, le=10)
    filler_words: int  = Field(0,  ge=0)
    turns:        int  = Field(0,  ge=0)


class GenerateReportResponse(BaseModel):
    overall_score: float
    feedback:      str
    metrics:       dict[str, Any]
