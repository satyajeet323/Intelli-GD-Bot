"""
services/audio_service.py — Audio transcription and prosody analysis.

Consolidates all audio-processing logic from server/main.py.
"""

import asyncio
import glob
import os
import shutil
import subprocess
import uuid
from concurrent.futures import ThreadPoolExecutor

import librosa
import numpy as np
import scipy.signal as sig

# Resolve config from env — avoids bootstrap ordering dependency on ml_server.config
_HERE           = os.path.dirname(os.path.abspath(__file__))
_ROOT           = os.path.dirname(_HERE)
_CHUNK_SEC      = int(os.getenv("CHUNK_DURATION_SEC", "15"))
_WHISPER_MODEL  = os.getenv("WHISPER_MODEL", "tiny.en")
_TEMP_DIR       = os.getenv("TEMP_DIR",       os.path.join(_ROOT, "temp"))
_TEMP_AUDIO_DIR = os.getenv("TEMP_AUDIO_DIR", os.path.join(_ROOT, "temp_audio"))

import logging
log = logging.getLogger("ml.audio")
_executor = ThreadPoolExecutor(max_workers=2)

from ml_server.models.crnn_model import compute_fillers
from ml_server.utils.ffmpeg_helper import get_ffmpeg_bin

# ── Whisper singleton ─────────────────────────────────────────────────────────
_whisper = None

def _get_whisper():
    global _whisper
    if _whisper is None:
        import whisper
        _whisper = whisper.load_model(_WHISPER_MODEL)
        log.info("Whisper model loaded: %s", _WHISPER_MODEL)
    return _whisper


# ── Praat / librosa F0 ────────────────────────────────────────────────────────
try:
    import parselmouth
    _HAS_PRAAT = True
except Exception:
    parselmouth = None
    _HAS_PRAAT  = False


def _load_mono(path: str, sr: int = 16000):
    y, _sr = librosa.load(path, sr=sr, mono=True)
    mx = np.max(np.abs(y))
    if mx > 0:
        y = y / mx
    return y, sr


def _energy_vad(y, sr):
    frame_len = int(sr * 25 / 1000)
    hop_len   = int(sr * 10 / 1000)
    rms       = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop_len, center=True)[0]
    thr       = np.percentile(rms, 25)
    voiced    = rms > thr

    segments, start = [], None
    for i, v in enumerate(voiced):
        if v and start is None:       start = i
        elif not v and start is not None:
            segments.append((start, i)); start = None
    if start is not None:
        segments.append((start, len(rms)))

    seg_times = [
        (s * hop_len / sr, e * hop_len / sr)
        for s, e in segments
        if (e - s) * hop_len / sr >= 0.08
    ]
    pauses = [
        (seg_times[i][1], seg_times[i + 1][0])
        for i in range(len(seg_times) - 1)
    ]
    return seg_times, pauses


def _syllable_nuclei(y, sr, voiced_segments):
    onset  = librosa.onset.onset_strength(y=y, sr=sr, hop_length=160)
    peaks, _ = sig.find_peaks(onset, distance=4, prominence=np.mean(onset))
    times  = librosa.frames_to_time(peaks, sr=sr, hop_length=160)
    return sorted(
        float(t) for t in times
        for (s, e) in voiced_segments if s <= float(t) <= e
    )


def _npvi(nucleus_times):
    if len(nucleus_times) < 3:
        return None
    durs = np.diff(nucleus_times)
    durs = durs[(durs > 0.08) & (durs < 0.8)]
    if len(durs) < 2:
        return None
    ratios = np.abs((durs[:-1] - durs[1:]) / ((durs[:-1] + durs[1:]) / 2.0 + 1e-9))
    return float(100.0 * np.mean(ratios))


def _f0_praat(wav_path):
    snd   = parselmouth.Sound(wav_path)
    pitch = snd.to_pitch()
    f0    = np.array([
        float(x) if (x and x > 0) else np.nan
        for x in pitch.selected_array["frequency"]
    ])
    return f0


def _f0_librosa(y, sr):
    try:
        f0, _, _ = librosa.pyin(y, fmin=75.0, fmax=450.0, sr=sr)
        return f0
    except Exception:
        return np.array([np.nan])


def _pitch_stats(f0_arr):
    f0v = f0_arr[~np.isnan(f0_arr)]
    if len(f0v) < 5:
        return {"pitch_mean": None, "pitch_std": None, "pitch_stability": None}
    p5, p95 = np.percentile(f0v, [5, 95])
    return {
        "pitch_mean":      float(np.mean(f0v)),
        "pitch_std":       float(np.std(f0v)),
        "pitch_p5":        float(p5),
        "pitch_p95":       float(p95),
        "pitch_range":     float(p95 - p5),
        "pitch_stability": float(np.std(f0v) / (np.mean(f0v) + 1e-9)),
        "jitter_like":     float(
            np.mean(np.abs(np.diff(1.0 / (f0v + 1e-9)))) / (np.mean(1.0 / (f0v + 1e-9)) + 1e-9)
        ) if len(f0v) > 2 else None,
    }


def analyze_prosody(wav_path: str, transcript: str = "") -> dict:
    y, sr        = _load_mono(wav_path)
    duration     = float(librosa.get_duration(y=y, sr=sr))
    voiced, pauses = _energy_vad(y, sr)
    nuclei       = _syllable_nuclei(y, sr, voiced)
    npvi_val     = _npvi(nuclei)

    words = len(transcript.strip().split()) if transcript.strip() else 0
    wpm   = ((words or len(nuclei)) / max(1e-6, duration)) * 60.0

    if _HAS_PRAAT:
        try:
            f0 = _f0_praat(wav_path)
        except Exception:
            f0 = _f0_librosa(y, sr)
    else:
        f0 = _f0_librosa(y, sr)

    pstats      = _pitch_stats(f0)
    total_pause = sum(e - s for s, e in pauses) if pauses else 0.0
    pause_ratio = total_pause / max(1e-9, duration)

    return {
        "duration_sec":          round(duration, 2),
        "speech_rate_wpm":       round(wpm, 2),
        "syllable_nuclei_count": len(nuclei),
        "nPVI":                  round(float(npvi_val), 2) if npvi_val is not None else None,
        "pause_ratio":           round(pause_ratio, 3),
        "total_pause_s":         round(total_pause, 2),
        **pstats,
    }


# ── FFmpeg helpers ─────────────────────────────────────────────────────────────
def _convert_to_wav(input_path: str, wav_path: str):
    ffmpeg = get_ffmpeg_bin()
    cmd    = [ffmpeg, "-y", "-i", input_path, "-ar", "16000", "-ac", "1", wav_path]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg conversion failed: {result.stderr.decode(errors='replace')}"
        )


def _split_wav(wav_path: str, out_dir: str, chunk_sec: int):
    os.makedirs(out_dir, exist_ok=True)
    pattern = os.path.join(out_dir, "chunk_%03d.wav")
    ffmpeg  = get_ffmpeg_bin()
    cmd     = [
        ffmpeg, "-y", "-i", wav_path,
        "-f", "segment", "-segment_time", str(chunk_sec),
        "-c", "pcm_s16le", "-ac", "1", "-ar", "16000",
        pattern,
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        log.warning("ffmpeg split warning: %s", result.stderr.decode(errors="replace"))


# ── Public: transcribe + prosody ──────────────────────────────────────────────
def process_audio_file(file_bytes: bytes, content_type: str, original_name: str) -> dict:
    """
    Full pipeline: save → convert → split → transcribe → prosody → filler detection.

    Returns dict matching AudioUploadResponse.
    """
    import time
    os.makedirs(_TEMP_DIR, exist_ok=True)
    os.makedirs(_TEMP_AUDIO_DIR, exist_ok=True)

    t0       = time.time()
    file_id  = str(uuid.uuid4())
    ext      = original_name.rsplit(".", 1)[-1] if "." in original_name else "webm"
    raw_path = os.path.join(_TEMP_DIR, f"{file_id}.{ext}")
    wav_path = os.path.join(_TEMP_DIR, f"{file_id}.wav")
    chk_dir  = os.path.join(_TEMP_DIR, f"{file_id}_chunks")
    tmp      = [raw_path, wav_path, chk_dir]

    try:
        with open(raw_path, "wb") as f:
            f.write(file_bytes)

        _convert_to_wav(raw_path, wav_path)

        # Filler detection
        fillers = compute_fillers(wav_path)

        # Chunk + transcribe
        _split_wav(wav_path, chk_dir, _CHUNK_SEC)
        chunk_files = sorted(glob.glob(os.path.join(chk_dir, "*.wav")))
        asr         = _get_whisper()
        t1          = time.time()
        transcript  = ""

        if not chunk_files:
            res        = asr.transcribe(wav_path)
            transcript = res.get("text", "").strip()
        else:
            for cf in chunk_files:
                res        = asr.transcribe(cf)
                transcript += res.get("text", "").strip() + " "
        t2 = time.time()

        prosody          = analyze_prosody(wav_path, transcript=transcript)
        prosody["fillers"] = fillers

        return {
            "transcript": transcript.strip(),
            "prosody":    prosody,
            "timings": {
                "total_time_sec":   round(time.time() - t0, 2),
                "transcription_sec": round(t2 - t1, 2),
            },
        }
    finally:
        for p in tmp:
            try:
                if os.path.isdir(p):  shutil.rmtree(p)
                elif os.path.exists(p): os.remove(p)
            except Exception:
                pass


async def process_audio_async(file_bytes: bytes, content_type: str, name: str) -> dict:
    """Non-blocking wrapper for use in async FastAPI route handlers."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _executor, process_audio_file, file_bytes, content_type, name
    )
