@echo off
REM setup-ml-models.bat — Copy ML model weights to ml-server/models/
REM Run from project root: scripts\setup-ml-models.bat

echo [setup] Copying ML model files to ml-server/models/...

if not exist "ml-server\models" mkdir "ml-server\models"

if exist "server\filler_crnn_final.pth" (
    copy /Y "server\filler_crnn_final.pth" "ml-server\models\filler_crnn_final.pth"
    echo [OK] filler_crnn_final.pth copied.
) else (
    echo [WARN] server\filler_crnn_final.pth not found — skipping.
    echo        The CRNN filler detection model will not work until this file is present.
)

echo.
echo [setup] Done. Start the ML service with:
echo         cd ml-server
echo         pip install -r requirements.txt
echo         uvicorn main:app --host 0.0.0.0 --port 8000
