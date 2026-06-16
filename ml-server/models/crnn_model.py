"""
models/crnn_model.py — FillerCRNN model definition and loader.

Moved from server/CRNN.py.
Model file: ml-server/models/filler_crnn_final.pth (copy from server/)
"""

import logging
import os
import numpy as np
import soundfile as sf
import torch
import torch.nn as nn
import librosa

# Resolve paths relative to this file — no cross-package imports
_HERE          = os.path.dirname(os.path.abspath(__file__))
_MODEL_PATH    = os.getenv("FILLER_MODEL_PATH", os.path.join(_HERE, "filler_crnn_final.pth"))
_ROOT          = os.path.dirname(_HERE)
_SEGMENTS_DIR  = os.getenv("SEGMENTS_DIR",  os.path.join(_ROOT, "segments_temp"))
_NUM_SEGMENTS  = int(os.getenv("CRNN_NUM_SEGMENTS", "6"))

log    = logging.getLogger("ml.crnn")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── CRNN constants (must match training config) ────────────────────────────────
DATASET_SAMPLE_RATE = 44064
N_MELS              = 128
TOTAL_FRAMES        = 2584


# ── Architecture ──────────────────────────────────────────────────────────────
class FillerCRNN(nn.Module):
    def __init__(self, num_classes: int = 2, rnn_hidden: int = 128):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=(3, 3), padding=1),
            nn.BatchNorm2d(32), nn.ReLU(), nn.MaxPool2d((2, 2)),
            nn.Conv2d(32, 64, kernel_size=(3, 3), padding=1),
            nn.BatchNorm2d(64), nn.ReLU(), nn.MaxPool2d((2, 2)),
        )
        self.gru = nn.GRU(
            input_size=64 * 32, hidden_size=rnn_hidden,
            batch_first=True, bidirectional=True,
        )
        self.classifier = nn.Sequential(
            nn.Linear(rnn_hidden * 2, 64), nn.ReLU(),
            nn.Dropout(0.3), nn.Linear(64, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv(x)
        b, c, f, t = x.size()
        x = x.permute(0, 3, 1, 2).contiguous().view(b, t, c * f)
        out, _ = self.gru(x)
        return self.classifier(out.mean(dim=1))


# ── Singleton loader ──────────────────────────────────────────────────────────
_model: FillerCRNN | None = None


def load_model() -> FillerCRNN:
    global _model
    if _model is None:
        if not os.path.isfile(_MODEL_PATH):
            raise FileNotFoundError(
                f"CRNN model not found at {_MODEL_PATH}. "
                "Run: scripts/setup-ml-models.bat  (or .sh)"
            )
        _model = FillerCRNN(num_classes=2).to(DEVICE)
        _model.load_state_dict(
            torch.load(_MODEL_PATH, map_location=DEVICE, weights_only=True)
        )
        _model.eval()
        log.info("CRNN loaded from %s on %s", _MODEL_PATH, DEVICE)
    return _model


# ── Audio helpers ─────────────────────────────────────────────────────────────
def _to_spec(y: np.ndarray, sr: int) -> np.ndarray:
    if sr != DATASET_SAMPLE_RATE:
        y = librosa.resample(y, orig_sr=sr, target_sr=DATASET_SAMPLE_RATE)
    S    = librosa.feature.melspectrogram(y=y, sr=DATASET_SAMPLE_RATE, n_mels=N_MELS)
    S_db = np.clip(librosa.power_to_db(S, ref=np.max), -80.0, 0.0)
    if S_db.ndim == 2:
        S_db = np.expand_dims(S_db, 0)
    _, _, w = S_db.shape
    if w < TOTAL_FRAMES:
        S_db = np.pad(S_db, ((0,0),(0,0),(0, TOTAL_FRAMES - w)), mode="constant")
    else:
        S_db = S_db[:, :, :TOTAL_FRAMES]
    return S_db


def _split_audio(audio_path: str) -> list[str]:
    os.makedirs(_SEGMENTS_DIR, exist_ok=True)
    y, sr     = librosa.load(audio_path, sr=None)
    seg_len   = len(y) // _NUM_SEGMENTS
    out_files = []
    for i in range(_NUM_SEGMENTS):
        start = i * seg_len
        end   = len(y) if i == _NUM_SEGMENTS - 1 else (i + 1) * seg_len
        path  = os.path.join(_SEGMENTS_DIR, f"segment_{i+1}.wav")
        sf.write(path, y[start:end], sr)
        out_files.append(path)
    return out_files


# ── Public API ────────────────────────────────────────────────────────────────
def compute_fillers(audio_path: str) -> int:
    """Return count of 10-s segments classified as filler speech."""
    model   = load_model()
    segs    = _split_audio(audio_path)
    count   = 0
    for seg in segs:
        y, sr  = librosa.load(seg, sr=None)
        S_db   = _to_spec(y, sr)
        tensor = torch.tensor(S_db, dtype=torch.float32).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            pred = int(torch.argmax(model(tensor), dim=1).item())
        count += pred
    log.debug("Filler segments: %d / %d", count, _NUM_SEGMENTS)
    return count
