#!/usr/bin/env bash
# setup-ml-models.sh — Copy ML model weights to ml-server/models/
# Run from project root: bash scripts/setup-ml-models.sh

set -e

echo "[setup] Copying ML model files to ml-server/models/..."
mkdir -p ml-server/models

SRC="server/filler_crnn_final.pth"
DST="ml-server/models/filler_crnn_final.pth"

if [[ -f "$SRC" ]]; then
    cp "$SRC" "$DST"
    echo "[OK] filler_crnn_final.pth copied."
else
    echo "[WARN] $SRC not found — skipping."
    echo "       The CRNN filler detection model will not work until this file is present."
fi

echo ""
echo "[setup] Done. Start the ML service with:"
echo "        cd ml-server"
echo "        pip install -r requirements.txt"
echo "        uvicorn main:app --host 0.0.0.0 --port 8000"
