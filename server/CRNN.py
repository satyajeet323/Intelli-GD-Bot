# file: CRNN.py
import torch
import librosa
import numpy as np
import os
import soundfile as sf

# ---------- CONFIG ----------
_HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(_HERE, "filler_crnn_final.pth")
SEGMENT_DIR = os.path.join(_HERE, "segments_temp")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DATASET_SAMPLE_RATE = 44064
N_MELS = 128
TOTAL_FRAMES = 2584
HOP_LENGTH = 512
NUM_SEGMENTS = 6

# ---------- CRNN MODEL ----------
import torch.nn as nn

class FillerCRNN(nn.Module):
    def __init__(self, num_classes=2, rnn_hidden=128):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=(3,3), padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d((2,2)),
            nn.Conv2d(32, 64, kernel_size=(3,3), padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d((2,2))
        )
        self.gru = nn.GRU(input_size=64*32, hidden_size=rnn_hidden,
                          batch_first=True, bidirectional=True)
        self.classifier = nn.Sequential(
            nn.Linear(rnn_hidden*2, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        # x: (batch,1,128,time)
        x = self.conv(x)
        b, c, f, t = x.size()
        x = x.permute(0,3,1,2).contiguous().view(b, t, c*f)  # (batch,time',channels*freq)
        rnn_out, _ = self.gru(x)
        x = rnn_out.mean(dim=1)
        return self.classifier(x)

# ---------- LOAD MODEL ----------
_model = None
def load_model():
    global _model
    if _model is None:
        _model = FillerCRNN(num_classes=2).to(DEVICE)
        _model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
        _model.eval()
    return _model

# ---------- UTILITY FUNCTIONS ----------
def audio_to_spec_from_array(y, sr):
    if sr != DATASET_SAMPLE_RATE:
        y = librosa.resample(y, orig_sr=sr, target_sr=DATASET_SAMPLE_RATE)
        sr = DATASET_SAMPLE_RATE
    S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=N_MELS)
    S_db = librosa.power_to_db(S, ref=np.max)
    S_db = np.clip(S_db, -80.0, 0.0)
    if S_db.ndim == 2:
        S_db = np.expand_dims(S_db, axis=0)
    _, _, w = S_db.shape
    if w < TOTAL_FRAMES:
        S_db = np.pad(S_db, ((0,0),(0,0),(0,TOTAL_FRAMES - w)), mode="constant")
    elif w > TOTAL_FRAMES:
        S_db = S_db[:, :, :TOTAL_FRAMES]
    return S_db, sr

def audio_to_spec(audio_path):
    y, sr = librosa.load(audio_path, sr=None)
    return audio_to_spec_from_array(y, sr)

def split_audio(audio_path, segment_dir=SEGMENT_DIR, num_segments=NUM_SEGMENTS):
    os.makedirs(segment_dir, exist_ok=True)
    y, sr = librosa.load(audio_path, sr=None)
    segment_length = len(y) // num_segments
    segment_files = []
    for i in range(num_segments):
        start = i * segment_length
        end = len(y) if i == num_segments-1 else (i+1)*segment_length
        segment_y = y[start:end]
        seg_file = os.path.join(segment_dir, f"segment_{i+1}.wav")
        sf.write(seg_file, segment_y, sr)
        segment_files.append(seg_file)
    return segment_files

# ---------- MAIN FUNCTION ----------
def compute_fillers(audio_path, return_prob=False):
    """
    Given a 1-minute audio path, compute filler detection.

    Returns:
        {
            'segment_preds': [0,1,0,...],
            'filler_detected': True/False,
            'filler_fraction': float,
            'segment_probs': [...]  # if return_prob=True
        }
    """
    model = load_model()
    label_map = {0: "Non-filler", 1: "Filler"}

    segment_files = split_audio(audio_path)
    segment_preds = []
    segment_probs = []

    for seg_file in segment_files:
        S_db, _ = audio_to_spec(seg_file)
        spec_tensor = torch.tensor(S_db, dtype=torch.float32).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            logits = model(spec_tensor)
            probs = torch.softmax(logits, dim=1).cpu().numpy().flatten()
            pred = int(np.argmax(probs))
        segment_preds.append(pred)
        segment_probs.append(probs)
        print(segment_preds)
        print(segment_probs)

    # Count number of segments classified as filler
    num_filler_segments = sum(segment_preds)
    print(num_filler_segments)

    
 
    

    
    return num_filler_segments



