# ML Models

Place the following model files here before starting the ML service:

| File | Source | Description |
|------|--------|-------------|
| `filler_crnn_final.pth` | `server/filler_crnn_final.pth` | Pre-trained FillerCRNN weights |

## Setup

Run from the project root:

```bash
# Windows
copy server\filler_crnn_final.pth ml-server\models\filler_crnn_final.pth

# Linux / macOS
cp server/filler_crnn_final.pth ml-server/models/filler_crnn_final.pth
```

Or run the provided setup script:

```bash
# Windows
scripts\setup-ml-models.bat

# Linux / macOS
bash scripts/setup-ml-models.sh
```

The SBERT (`all-MiniLM-L6-v2`) and Whisper (`tiny.en`) models are downloaded
automatically on first use from HuggingFace Hub and OpenAI respectively.
They are cached in the default model directories:
- HuggingFace: `~/.cache/huggingface/`
- Whisper: `~/.cache/whisper/`
