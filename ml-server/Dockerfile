# ============================================================
# ml-server/Dockerfile — FastAPI ML microservice
# Multi-stage: heavy ML deps cached separately for faster rebuilds
# ============================================================

# ── Stage 1: Heavy ML dependencies (cached layer) ────────────────────────────
FROM python:3.11-slim AS ml-deps
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

# PyTorch CPU wheel (large — kept in its own layer for cache efficiency)
RUN pip install --no-cache-dir \
    torch==2.2.0 \
    torchaudio==2.2.0 \
    --index-url https://download.pytorch.org/whl/cpu

# Remaining dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime image ────────────────────────────────────────────────────
FROM python:3.11-slim AS runner
WORKDIR /app

# Runtime system deps only
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
 && rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN addgroup --system --gid 1001 mlgroup \
 && adduser  --system --uid 1001 mlapp

# Copy installed packages from build stage
COPY --from=ml-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=ml-deps /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=mlapp:mlgroup . .

# Create required working directories
RUN mkdir -p temp temp_audio segments_temp reports logs \
 && chown -R mlapp:mlgroup temp temp_audio segments_temp reports logs

ARG BUILD_SHA=unknown
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    BUILD_SHA=${BUILD_SHA}

HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

USER mlapp
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
