# ML Server Deployment

## Why NOT Vercel

The ml-server cannot run on Vercel because:
- PyTorch + Whisper = ~2GB (Vercel limit: 250MB)
- Requires ffmpeg system binary
- Audio processing takes up to 2 minutes (Vercel max: 60s)
- Needs writable temp filesystem

## Option 1: Hugging Face Spaces (Recommended — Free)

1. Create account at huggingface.co
2. New Space → Docker SDK → name: `intellibot-ml`
3. Push ml-server/ contents to the Space repo:
   ```
   git clone https://huggingface.co/spaces/YOUR_USERNAME/intellibot-ml
   cp -r ml-server/* intellibot-ml/
   cd intellibot-ml && git add . && git commit -m "deploy" && git push
   ```
4. Add secrets in Space Settings:
   - GEMINI_API_KEY
   - NODE_SERVER_URL (your Railway backend URL)
   - INTERNAL_SERVICE_SECRET

Space URL: https://YOUR_USERNAME-intellibot-ml.hf.space

## Option 2: Render (Free tier, sleeps after 15min)

1. render.com → New Web Service → connect GitHub
2. Root directory: ml-server
3. Runtime: Docker
4. Add env vars from ml-server/.env

## Option 3: Railway ($5 credit/month)

Same as Render but doesn't sleep.

## After deploying

Set in server/.env (Railway/Render backend):
```
ML_SERVER_URL=https://your-ml-server-url.hf.space
```

Set in Vercel dashboard (client env var):
```
VITE_SERVER_URL=https://your-backend.railway.app
```
