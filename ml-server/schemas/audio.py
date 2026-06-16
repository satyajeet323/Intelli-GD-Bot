"""schemas/audio.py — Request/response models for audio analysis endpoints."""

from typing import Any
from pydantic import BaseModel, Field


class ProsodyMetrics(BaseModel):
    duration_sec: float       = Field(..., description="Total audio duration in seconds")
    speech_rate_wpm: float    = Field(..., description="Words per minute")
    syllable_nuclei_count: int = Field(..., description="Estimated syllable count")
    nPVI: float | None        = Field(None, description="Normalised Pairwise Variability Index")
    pause_ratio: float        = Field(..., description="Fraction of total time spent paused (0-1)")
    total_pause_s: float      = Field(..., description="Total pause duration in seconds")
    fillers: int              = Field(0,   description="Number of filler segments detected by CRNN")


class AudioUploadResponse(BaseModel):
    transcript: str
    prosody:    ProsodyMetrics
    timings:    dict[str, float]


class TranscriptScoreRequest(BaseModel):
    transcript: str = Field(..., min_length=1)
    topic:      str = Field(..., min_length=1)
    prosody:    dict[str, Any] = Field(default_factory=dict)


class TranscriptScoreResponse(BaseModel):
    score: dict[str, Any]
