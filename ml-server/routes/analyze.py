"""
routes/analyze.py — Audio and transcript analysis endpoints.

POST /analyze/audio      — Upload audio, get transcript + prosody + filler count
POST /analyze/transcript — Score a transcript against a topic
"""

import logging
from fastapi import APIRouter, File, HTTPException, UploadFile

from ml_server.schemas.audio import AudioUploadResponse, TranscriptScoreRequest, TranscriptScoreResponse
from ml_server.services.audio_service import process_audio_async
from ml_server.services.scoring_service import score_transcript_async

log    = logging.getLogger("ml.routes.analyze")
router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("/audio", response_model=AudioUploadResponse)
async def analyze_audio(audio: UploadFile = File(...)):
    """
    Receive a WebM/WAV audio file.
    Returns: transcript, prosody metrics, filler count, timing info.
    """
    if not (audio.content_type or "").startswith("audio/"):
        raise HTTPException(400, f"Invalid content type: {audio.content_type}")

    file_bytes = await audio.read()
    if not file_bytes:
        raise HTTPException(400, "Empty audio file.")

    try:
        result = await process_audio_async(
            file_bytes, audio.content_type or "audio/webm", audio.filename or "recording.webm"
        )
    except Exception as exc:
        log.exception("Audio processing failed")
        raise HTTPException(500, f"Audio processing failed: {exc}") from exc

    if "error" in result:
        raise HTTPException(422, result["error"])

    return result


@router.post("/transcript", response_model=TranscriptScoreResponse)
async def analyze_transcript(req: TranscriptScoreRequest):
    """
    Score a transcript against a topic.
    Returns: 13-field JSON score object from Gemini + semantic relevance.
    """
    if len(req.transcript.split()) < 10:
        raise HTTPException(422, "Transcript is too short for scoring.")

    try:
        score = await score_transcript_async(req.topic, req.transcript, req.prosody)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        log.exception("Transcript scoring failed")
        raise HTTPException(500, f"Scoring failed: {exc}") from exc

    return {"score": score}
