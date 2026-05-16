# file: fluency_service.py
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import whisper
import uuid
import os
import shutil
import subprocess
import glob
import json
import re
import time
import ffmpeg
try:
    import imageio_ffmpeg as _imageio_ffmpeg
except Exception:
    _imageio_ffmpeg = None
import asyncio
import numpy as np
import librosa
import scipy.signal as sig
import google.genai as genai_new
from CRNN import compute_fillers
from Semantic import compute_relevance
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ========== Configuration ==========
GEMINI_MODEL = "gemini-2.5-flash"
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")

if not GOOGLE_API_KEY:
    raise ValueError("GEMINI_API_KEY must be set in .env")

_gemini_client = genai_new.Client(api_key=GOOGLE_API_KEY)

def _generate(prompt):
    """Call Gemini for content generation."""
    response = _gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return response.text
_HERE = os.path.dirname(os.path.abspath(__file__))
TEMP_DIR = os.path.join(_HERE, "temp")
TEMP_AUDIO_DIR = os.path.join(_HERE, "temp_audio")
CHUNK_DURATION = 15  # seconds per chunk for Whisper

# ========== Setup ==========
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)
asr_model = whisper.load_model("tiny.en")  # Whisper ASR

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://localhost:4000",  # Node.js proxy
        "http://localhost:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Helper: Split audio
# -------------------------
def _get_ffmpeg_bin():
    """Return a usable path to ffmpeg executable across environments."""
    # 1) imageio-ffmpeg managed binary (bundles its own ffmpeg exe)
    if _imageio_ffmpeg is not None:
        try:
            exe = _imageio_ffmpeg.get_ffmpeg_exe()
            if exe and os.path.isfile(exe):
                print(f"[ffmpeg] Using imageio-ffmpeg: {exe}")
                return exe
        except Exception as e:
            print(f"[ffmpeg] imageio-ffmpeg failed: {e}")

    # 2) Search all Python site-packages for imageio_ffmpeg binaries (covers venv scenarios)
    try:
        import glob as _glob
        import site as _site
        search_roots = []
        try:
            search_roots += _site.getsitepackages()
        except Exception:
            pass
        try:
            search_roots.append(_site.getusersitepackages())
        except Exception:
            pass
        # Also check the Python that owns this interpreter
        search_roots.append(os.path.dirname(os.path.dirname(os.__file__)))
        for root in search_roots:
            pattern = os.path.join(root, "imageio_ffmpeg", "binaries", "ffmpeg*.exe")
            matches = _glob.glob(pattern)
            if matches:
                exe = matches[0]
                print(f"[ffmpeg] Found via site-packages scan: {exe}")
                return exe
    except Exception as e:
        print(f"[ffmpeg] site-packages scan failed: {e}")

    # 3) System PATH
    try:
        which = shutil.which("ffmpeg")
        if which:
            print(f"[ffmpeg] Using PATH ffmpeg: {which}")
            return which
    except Exception:
        pass

    # 4) Common Windows install locations
    common_paths = [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
    ]
    for p in common_paths:
        if os.path.isfile(p):
            print(f"[ffmpeg] Found at common path: {p}")
            return p

    # 5) Known user site-packages path (last resort hardcoded fallback)
    fallback = os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        "Programs", "Python", "Python313", "Lib", "site-packages",
        "imageio_ffmpeg", "binaries", "ffmpeg-win-x86_64-v7.1.exe"
    )
    if os.path.isfile(fallback):
        print(f"[ffmpeg] Using hardcoded fallback: {fallback}")
        return fallback

    raise RuntimeError(
        "ffmpeg not found. Run: pip install imageio-ffmpeg  OR  winget install ffmpeg"
    )


def split_audio_ffmpeg(input_wav, output_dir, chunk_duration):
    os.makedirs(output_dir, exist_ok=True)
    output_pattern = os.path.join(output_dir, "chunk_%03d.wav")
    ffmpeg_bin = _get_ffmpeg_bin()
    cmdline = [
        ffmpeg_bin, "-y", "-i", input_wav,
        "-f", "segment",
        "-segment_time", str(chunk_duration),
        "-c", "pcm_s16le",
        "-ac", "1",
        "-ar", "16000",
        output_pattern
    ]
    print(f"[ffmpeg] Splitting: {cmdline}")
    result = subprocess.run(cmdline, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        print(f"[ffmpeg] split warning: {result.stderr.decode(errors='replace')}")



# -------------------------
# Prosody & Rhythm Analysis
# -------------------------
try:
    import parselmouth
    _HAS_PRAAT = True
except Exception:
    parselmouth = None
    _HAS_PRAAT = False

def load_audio_mono(path: str, sr: int = 16000):
    y, _sr = librosa.load(path, sr=sr, mono=True)
    if np.max(np.abs(y)) > 0:
        y = y / np.max(np.abs(y))
    return y, sr

def energy_vad_frames(y, sr, frame_len_ms=25, hop_ms=10, energy_percentile=25.0):
    frame_len = int(sr * frame_len_ms / 1000)
    hop_len = int(sr * hop_ms / 1000)
    rms = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop_len, center=True)[0]
    thr = np.percentile(rms, energy_percentile)
    voiced_mask = rms > thr
    segments, start = [], None
    for i, v in enumerate(voiced_mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            segments.append((start, i))
            start = None
    if start is not None:
        segments.append((start, len(rms)))
    seg_times = [(s * hop_len / sr, e * hop_len / sr) for s, e in segments if (e - s) * hop_len / sr >= 0.08]
    pauses = [(seg_times[i][1], seg_times[i+1][0]) for i in range(len(seg_times)-1)]
    return seg_times, pauses, rms, hop_len

def estimate_syllable_nuclei(y, sr, voiced_segments):
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=160)
    peaks, _ = sig.find_peaks(onset_env, distance=4, prominence=np.mean(onset_env))
    times = librosa.frames_to_time(peaks, sr=sr, hop_length=160)
    kept = [float(t) for t in times for (s, e) in voiced_segments if s <= t <= e]
    return sorted(kept)

def npvi_from_times(nucleus_times):
    if len(nucleus_times) < 3:
        return float("nan")
    durs = np.diff(nucleus_times)
    durs = durs[(durs > 0.08) & (durs < 0.8)]
    if len(durs) < 2:
        return float("nan")
    ratios = np.abs((durs[:-1] - durs[1:]) / ((durs[:-1] + durs[1:]) / 2.0 + 1e-9))
    return float(100.0 * np.mean(ratios))

def extract_f0_with_parselmouth(wav_path, fmin=75.0, fmax=450.0):
    snd = parselmouth.Sound(wav_path)
    pitch = snd.to_pitch()
    f0 = np.array([float(x) if (x and x > 0) else np.nan for x in pitch.selected_array["frequency"]])
    times = np.linspace(0, snd.get_total_duration(), num=len(f0), endpoint=False)
    return f0, times

def extract_f0_with_librosa(y, sr, fmin=75.0, fmax=450.0):
    try:
        f0, _, _ = librosa.pyin(y, fmin=fmin, fmax=fmax, sr=sr)
        times = librosa.times_like(f0, sr=sr)
        return f0, times
    except Exception:
        return np.array([np.nan]), np.array([0.0])

def pitch_stats(f0_arr):
    f0v = f0_arr[~np.isnan(f0_arr)]
    if len(f0v) < 5:
        return {k: float("nan") for k in ["pitch_mean","pitch_std","pitch_p5","pitch_p95","pitch_range","pitch_stability","jitter_like"]}
    p5, p95 = np.percentile(f0v, [5, 95])
    return {
        "pitch_mean": float(np.mean(f0v)),
        "pitch_std": float(np.std(f0v)),
        "pitch_p5": float(p5),
        "pitch_p95": float(p95),
        "pitch_range": float(p95 - p5),
        "pitch_stability": float(np.std(f0v) / (np.mean(f0v) + 1e-9)),
        "jitter_like": float(np.mean(np.abs(np.diff(1.0/(f0v+1e-9)))) / (np.mean(1.0/(f0v+1e-9)) + 1e-9)) if len(f0v) > 2 else float("nan")
    }

def analyze_prosody(wav_path, transcript=None):
    y, sr = load_audio_mono(wav_path, sr=16000)
    duration = float(librosa.get_duration(y=y, sr=sr))
    voiced_segments, pauses, _, _ = energy_vad_frames(y, sr)
    nuclei = estimate_syllable_nuclei(y, sr, voiced_segments)
    nPVI = npvi_from_times(nuclei)

    # speech rate
    if transcript and transcript.strip():
        words = len(transcript.strip().split())
        wpm = (words / max(1e-6, duration)) * 60.0
    else:
        wpm = (len(nuclei) / max(1e-6, duration)) * 60.0

    # pitch
    if _HAS_PRAAT:
        try:
            f0_arr, _ = extract_f0_with_parselmouth(wav_path)
        except Exception:
            f0_arr, _ = extract_f0_with_librosa(y, sr)
    else:
        f0_arr, _ = extract_f0_with_librosa(y, sr)
    pstats = pitch_stats(f0_arr)

    # pauses
    total_pause = sum(e-s for s, e in pauses) if pauses else 0.0
    pause_ratio = float(total_pause / max(1e-9, duration))

    return {
        "duration_sec": round(duration, 2),
        "speech_rate_wpm": round(wpm, 2),
        "syllable_nuclei_count": len(nuclei),
        "nPVI": None if np.isnan(nPVI) else round(float(nPVI), 2),
        "pause_ratio": round(pause_ratio, 3),
        "total_pause_s": round(total_pause, 2)
    }

# -------------------------
# Endpoint: Health
# -------------------------
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "fluency"}

# -------------------------
# Endpoint: Topic
# -------------------------
@app.get("/api/fluency/topic")
async def generate_topic():
    if not _gemini_client:
        return {"error": "GEMINI_API_KEY is not configured."}

    prompt = "Generate one open-ended discussion topic related to technology or current affairs. Return the topic text only, no explanation, no quotes."
    try:
        topic = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(None, _generate, prompt),
            timeout=12
        )
        topic = topic.strip().strip('"\'')
        if topic:
            return {"topic": topic}
        return {"error": "Empty topic returned."}
    except Exception as e:
        return {"error": f"Topic generation failed: {str(e)}"}

# -------------------------
# Endpoint: Upload & Transcribe
# -------------------------
@app.post("/api/fluency/upload")
async def upload_audio(audio: UploadFile = File(...)):
    start_time = time.time()
    tmp_paths = []
    try:
        if not audio.content_type.startswith("audio/"):
            return {"error": f"Invalid file type: {audio.content_type}"}

        file_id = str(uuid.uuid4())
        input_path = os.path.join(TEMP_DIR, f"{file_id}.webm")
        wav_path = os.path.join(TEMP_DIR, f"{file_id}.wav")
        chunks_dir = os.path.join(TEMP_DIR, f"{file_id}_chunks")
        tmp_paths.extend([input_path, wav_path, chunks_dir])

        with open(input_path, "wb") as f:
            f.write(await audio.read())

        ffmpeg_bin = _get_ffmpeg_bin()
        # Use subprocess directly — avoids ffmpeg-python path issues on Windows with spaces
        cmdline = [ffmpeg_bin, "-y", "-i", input_path, "-ar", "16000", "-ac", "1", wav_path]
        print(f"[ffmpeg] Running: {cmdline}")
        result = subprocess.run(cmdline, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg conversion failed: {result.stderr.decode(errors='replace')}")
        filler_metrics = compute_fillers(wav_path, return_prob=True)
        print(filler_metrics)
        
        split_audio_ffmpeg(wav_path, chunks_dir, CHUNK_DURATION)

        transcript, chunk_files = "", sorted(glob.glob(os.path.join(chunks_dir, "*.wav")))
        t1 = time.time()
        if not chunk_files:
            result = asr_model.transcribe(wav_path)
            transcript = result.get("text", "").strip()
            word_segments = result.get("segments", None)
        else:
            word_segments = []
            for chunk_file in chunk_files:
                res = asr_model.transcribe(chunk_file)
                transcript += res.get("text", "").strip() + " "
                if "segments" in res:
                    word_segments.extend(res["segments"])
        t2 = time.time()

        prosody_metrics = analyze_prosody(wav_path, transcript=transcript)
        prosody_metrics["fillers"] = filler_metrics
        print(prosody_metrics)

        # Cleanup temp
        for p in tmp_paths:
            try:
                if os.path.isdir(p):
                    shutil.rmtree(p)
                elif os.path.exists(p):
                    os.remove(p)
            except:
                pass

        return {
            "transcript": transcript.strip(),
            "prosody": prosody_metrics,
            "timings": {
                "total_time_sec": round(time.time() - start_time, 2),
                "transcription_sec": round(t2 - t1, 2)
            }
        }

    except Exception as e:
        for p in tmp_paths:
            try:
                if os.path.isdir(p): shutil.rmtree(p)
                elif os.path.exists(p): os.remove(p)
            except:
                pass
        return {"error": f"Upload failed: {str(e)}"}

# -------------------------
# Endpoint: Score Transcript
# -------------------------
@app.post("/api/fluency/score")
async def score_fluency(data: dict):
    transcript = data.get("transcript", "").strip()
    print(transcript)
    topic = data.get("topic", "").strip()
    prosody = data.get("prosody", {})  # filler_metrics from /upload endpoint

    relevance_score = compute_relevance(topic, transcript)
    print(relevance_score)
    prosody['relevance_score'] = relevance_score

    if not transcript or not topic:
        return {"error": "Transcript or topic missing."}

    if len(transcript.split()) < 50:
        return {
            "status": "error",
            "reason": "too_few_words",
            "message": "Please speak at least 50 words."
        }

    # Include filler metrics inside prosody dict


    # Short transcript for evaluation
    sentences = re.split(r'(?<=[.?!])\s+', transcript)
    trimmed = sentences[:3] + sentences[-3:] if len(sentences) > 6 else sentences
    short_transcript = " ".join(trimmed)

    print(prosody)

    prosody_json = json.dumps(prosody, ensure_ascii=False)
    print(prosody_json)

    



# Example variables you will have in Python:
# topic = "Your topic string"
# short_transcript = "User's transcript (maybe truncated)"
# prosody_json = json.dumps(prosody_data)   # prosody_data is the dict your analyze_prosody() returns

    prompt = f"""
You are a STANDARDS-DRIVEN English speaking evaluator. Follow the rules exactly and do not add any extra commentary.

1) Input you MUST use:
- Topic: "{topic}"
- Transcript: "{short_transcript}"
- Prosody JSON: {prosody_json}

2) Purpose:
- Produce reproducible, rule-based numeric scores (integers 1–10 inclusive) for language metrics and prosody metrics.
- Identify grammatical mistakes and give concise, practical improvement tips.

3) General rules (apply strictly):
- All numeric scores must be integers between 1 and 10 (inclusive).
- If you compute a fractional score, round to the nearest integer.
- If a required numeric prosody input is missing or NaN, score that prosody metric neutrally as 5 and note missing data (but still return the numeric 5).
- Reply ONLY with valid JSON (no extra text, no markdown, no commentary).

4) Language scoring rubric. Score the transcript using strict numeric thresholds. Do not add subjective commentary (map transcript content to integer scores):
A) Vocabulary (Type-Token Ratio, TTR):
- TTR < 0.25 → 2
- 0.25 ≤ TTR < 0.40 → 5
- 0.40 ≤ TTR < 0.55 → 8
- TTR ≥ 0.55 → 10

B) Grammar (Errors per 100 words):
- ≥6 errors → 2
- 4–5 errors → 5
- 2–3 errors → 8
- 0–1 errors → 10

C) Sentence Correctness (% complete sentences):
- <60% → 2
- 60–74% → 5
- 75–89% → 8
- ≥90% → 10

D) Coherence (Avg cosine similarity between sentences / topic relevance):
- <0.45 → 2
- 0.45–0.59 → 5
- 0.60–0.74 → 8
- ≥0.75 → 10

E) Clarity (Flesch-Kincaid Reading Ease score):
- <30 → 2
- 30–49 → 5
- 50–59 → 8
- ≥60 → 10

5) Prosody scoring rules (use the numeric fields from Prosody JSON):
Use these keys from the prosody JSON if present: `speech_rate_wpm` (float), relevance_score' (int), 'fillers' (int), `pause_ratio` (fraction of time spent paused; 0.0–1.0), `pitch_stability` (std/mean of f0; lower = more monotone), `nPVI` (rhythm variability). If a different key is present use it instead (e.g., `total_pause_s` to derive pause_ratio), but prefer the named keys.

Map prosody values to integer scores **deterministically** as follows:

A) Speech Rate → `speech_rate_score`
- If `speech_rate_wpm` is missing or NaN → score = 5.
- Use this exact mapping (choose the integer that matches the range):
  - ≤ 60 WPM -> 1
  - 61–80 -> 2
  - 81–100 -> 4
  - 101–120 -> 6
  - 121–140 -> 8
  - 141–160 -> 9
  - 161–180 -> 8
  - 181–200 -> 5
  - > 200 -> 2
- Rationale: moderate-fast (120–160) is ideal for clear, fluent speech; very slow or extremely fast reduce score.

B) Pause Time → `pause_time_score`
- Use `pause_ratio` (if not present compute = total_pause_s / duration_sec).
- If missing -> score = 5.
- Mapping:
  - pause_ratio ≥ 0.40 -> 1
  - 0.30–0.39 -> 2
  - 0.20–0.29 -> 4
  - 0.12–0.19 -> 6
  - 0.07–0.11 -> 8
  - 0.04–0.06 -> 9
  - < 0.04 -> 7
- Rationale: too many pauses break fluency; too few pauses (<0.04) may be slightly unnatural—score remains good but not maximal.

C) Pitch Variability → `pitch_variability_score`
- Prefer `pitch_stability` (std/mean). Lower = monotone, middle = desirable, very high = unstable.
- If `pitch_stability` missing, you may use `pitch_range` or `pitch_std` as fallback.
- If missing -> score = 5.
- Mapping (pitch_stability as fraction):
  - < 0.01 -> 2   (too monotone)
  - 0.01–0.02 -> 4
  - 0.02–0.035 -> 7
  - 0.035–0.06 -> 9
  - 0.06–0.10 -> 6
  - > 0.10 -> 3  (too unstable)
- Rationale: extremely low variability sounds robotic; moderate variability is natural and expressive; extreme variability can be erratic.

D) Rhythm Variability → `rhythm_variability_score`
- Use `nPVI` (numeric). If missing -> score = 5.
- Mapping:
  - nPVI < 10 -> 2   (too regular/robotic)
  - 10–25 -> 4
  - 25–50 -> 8
  - 51–70 -> 6
  - > 70 -> 3        (too irregular)
- Rationale: mid-range nPVI typically corresponds to natural English rhythm; extremes are undesirable.

E) Filler Segments -> 'fillers_score'
- Map number of filler segments to a 0-10 fluency score as follows:
  - 0 fillers → 10/10 (excellent)
  - 1 filler → 9/10
  - 2 fillers → 7/10
  - 3 fillers → 5/10
  - 4 fillers → 3/10
  - 5 fillers → 2/10
  - 6 fillers → 0/10 (poor)
- Rationale: fewer fillers indicate better fluency; more fillers reduce the score proportionally.


7) Output JSON (ONLY this exact JSON object; DO NOT wrap or include commentary). Use integer scores and strings:

{{
  "vocabulary_score": int,
  "grammar_score": int,
  "sentence_correctness_score": int,
  "coherence_score": int,
  "clarity_score": int,
  "relevance_score": int,
  "grammatical_mistake": string,
  "improvement_needed": string,
  "speech_rate_score": int,
  "pause_time_score": int,
  "pitch_variability_score": int,
  "rhythm_variability_score": int,
  "fillers_score" : int,
}}

7) Special rules for mistakes and improvements:
- Return your response as a JSON object with exactly two fields:
1. "grammatical_mistake": A list of objects. Each object should have:
   - "mistake": The exact erroneous phrase or sentence with a short explanation.
   - "correction": The corrected version.
   Format each as:
     Mistake 1: '<error>' – <short explanation> \n
     Corrected 1: '<correction>' \n


2. "improvement_needed": A list of 4–5 actionable tips based on the transcript content and prosody scores.
   These should include practical steps on grammar, vocabulary, fluency, pronunciation, speech rate, or relevance.

Now produce the JSON response only, following the schema and using the values supplied above.
"""

    try:
        raw = _generate(prompt).strip()
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            raise ValueError("No JSON found.")
        return {"score": json.loads(m.group(0))}
    except Exception as e:
        return {"error": f"Gemini scoring failed: {str(e)}"}

# Run: uvicorn fluency_service:app --host 0.0.0.0 --port 8000
# uvicorn main:app --reload

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
