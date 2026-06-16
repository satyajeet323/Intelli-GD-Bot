"""schemas/audio.py — Request/response models for audio analysis endpoints."""

from typing import Any
from pydantic import BaseModel, Field


class ProsodyMetrics(BaseModel):
    """
    Accepts all fields returned by analyze_prosody() including optional pitch
    stats. extra='allow' prevents Pydantic from rejecting valid prosody dicts
    that contain pitch_mean, pitch_std, pitch_stability, etc.
    """
    model_config = {"extra": "allow"}

    duration_sec: float         = Field(..., description="Total audio duration in seconds")
    speech_rate_wpm: float      = Field(..., description="Words per minute")
    syllable_nuclei_count: int  = Field(..., description="Estimated syllable count")
    nPVI: float | None          = Field(None, description="Normalised Pairwise Variability Index")
    pause_ratio: float          = Field(..., description="Fraction of time spent paused (0-1)")
    total_pause_s: float        = Field(..., description="Total pause duration in seconds")
    fillers: int                = Field(0, description="Filler segments detected by CRNN")

    # Optional pitch fields — returned by analyze_prosody, not required by callers
    pitch_mean:      float | None = None
    pitch_std:       float | None = None
    pitch_p5:        float | None = None
    pitch_p95:       float | None = None
    pitch_range:     float | None = None
    pitch_stability: float | None = None
    jitter_like:     float | None = None


class AudioUploadResponse(BaseModel):
    """extra='allow' so future prosody fields never break serialisation."""
    model_config = {"extra": "allow"}

    transcript: str
    prosody:    ProsodyMetrics
    timings:    dict[str, float]


class TranscriptScoreRequest(BaseModel):
    transcript: str            = Field(..., min_length=1)
    topic:      str            = Field(..., min_length=1)
    prosody:    dict[str, Any] = Field(default_factory=dict)


class TranscriptScoreResponse(BaseModel):
    model_config = {"extra": "allow"}
    score: dict[str, Any]
