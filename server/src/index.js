/**
 * index.js — INTELLI BOT Backend — Fully Integrated System
 *
 * Modules wired together:
 *  ✓ MongoDB (Mongoose)       — persistent storage for users, sessions, reports
 *  ✓ Authentication (JWT)     — register, login, protected routes
 *  ✓ Session management       — create, join, leave, end, validate
 *  ✓ Real-time (Socket.io)    — WebRTC signalling, chat, roster, media state
 *  ✓ Topic generation         — Gemini AI → local fallback, category-aware
 *  ✓ Performance reporting    — per-turn tracking, score calculation, feedback
 *  ✓ Session history          — paginated, filtered, sorted, with stats
 *  ✓ Rate limiting            — per-IP on auth routes, per-user on API
 *  ✓ Structured logging       — request ID, method, path, status, duration
 *  ✓ Graceful shutdown        — drains connections before exit
 *  ✓ Global error handling    — no unhandled rejections crash the server
 */

import "dotenv/config";
import express          from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors             from "cors";
import jwt              from "jsonwebtoken";
import axios            from "axios";
import multer           from "multer";
import { createReadStream, unlink } from "fs";
import FormData         from "form-data";

import { connectDB }            from "./db.js";
import { requestLogger }        from "./middleware/logger.js";
import { rateLimiter }          from "./middleware/rateLimiter.js";
import authRoutes               from "./routes/auth.js";
import sessionRoutes            from "./routes/sessions.js";
import reportRoutes             from "./routes/reports.js";
import historyRoutes            from "./routes/history.js";
import topicRoutes              from "./routes/topics.js";
import chatRoutes               from "./routes/chat.js";
import peerRatingRoutes         from "./routes/peerRatings.js";
import aiSessionRoutes          from "./routes/aiSession.js";
import { registerSocketHandlers } from "./socketHandler.js";
import adminRoutes              from "./routes/admin/index.js";
import notificationRoutes       from "./routes/notifications.js";
import { Notification }         from "./models/Notification.js";
import { UserNotification }     from "./models/UserNotification.js";
import { User as UserModel }    from "./models/User.js";
import { metrics }              from "./routes/admin/analytics.js";
import { apiKeyService }        from "./services/apiKeyService.js";

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "4000", 10);
const IS_PROD = process.env.NODE_ENV === "production";

const CLIENT_ORIGINS = (
  process.env.CLIENT_ORIGINS ?? "http://localhost:5173,http://localhost:5174 , https://xnlzq10h-5174.inc1.devtunnels.ms/"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// ── MongoDB ───────────────────────────────────────────────────────────────────
// Non-blocking — server starts immediately; DB connects in background with retry
connectDB().catch((err) =>
  console.error("[db] Initial connect error:", err.message)
);

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();

// Security headers
app.disable("x-powered-by");
app.set("trust proxy", 1);

// CORS — allow configured client origins
app.use(
  cors({
    origin:      CLIENT_ORIGINS,
    credentials: true,
    methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Structured request logger (attaches req.requestId)
app.use(requestLogger);

// ── Metrics middleware ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  metrics.apiCalls++;
  res.on("finish", () => {
    const ms = Date.now() - start;
    if (metrics.apiLatencies.length >= 1000) metrics.apiLatencies.shift();
    metrics.apiLatencies.push(ms);
    if (res.statusCode >= 500) metrics.apiErrors++;
    if (res.statusCode === 401 && req.path.includes("/login")) metrics.failedLogins++;
  });
  next();
});

// ── Health & system endpoints ─────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status:  "ok",
    ts:      new Date().toISOString(),
    uptime:  Math.round(process.uptime()),
    env:     IS_PROD ? "production" : "development",
    modules: {
      auth:     true,
      sessions: true,
      realtime: true,
      topics:   true,
      reports:  true,
      history:  true,
    },
  });
});

// API map — useful for frontend discovery
app.get("/api", (_req, res) => {
  res.json({
    version: "1.0.0",
    endpoints: {
      auth:     { base: "/api/auth",     routes: ["POST /register", "POST /login", "GET /me"] },
      sessions: { base: "/api/sessions", routes: ["POST /", "GET /", "GET /:id", "GET /:id/validate", "POST /:id/join", "POST /:id/leave", "POST /:id/end", "DELETE /:id"] },
      reports:  { base: "/api/reports",  routes: ["POST /:id", "PATCH /:id/turn", "GET /:id", "GET /:id/me", "GET /:id/summary", "GET /:id/leaderboard"] },
      history:  { base: "/api/history",  routes: ["GET /", "GET /stats", "GET /search", "GET /:id", "DELETE /:id"] },
      topics:      { base: "/api/topics",       routes: ["GET /generate", "GET /categories", "GET /category/:name"] },
      chat:        { base: "/api/chat",         routes: ["POST /gd"] },
      peerRatings: { base: "/api/peer-ratings", routes: ["POST /:id", "GET /:id", "GET /:id/status", "GET /:id/summary"] },
    },
  });
});

// ── Dev-only test endpoint ────────────────────────────────────────────────────
if (!IS_PROD) {
  app.post("/api/test/session", async (_req, res) => {
    try {
      const { generateTopic } = await import("./topics.js");
      const { createSession } = await import("./sessionStore.js");
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const sessionId = [4, 4, 4]
        .map((len) =>
          Array.from({ length: len }, () =>
            chars[Math.floor(Math.random() * chars.length)]
          ).join("")
        )
        .join("-");
      const { topic, source } = await generateTopic();
      const session = createSession(sessionId, topic, source);
      res.status(201).json({ success: true, sessionId: session.id, topic: session.topic });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

// Strict brute-force guard — only on login & register (write endpoints)
const authWriteLimiter = rateLimiter({
  max:      IS_PROD ? 20 : 100,   // relaxed in dev so hot-reloads don't block you
  windowMs: 15 * 60_000,          // 15-minute window
  message:  "Too many auth attempts. Please wait 15 minutes.",
  keyBy:    "ip",
});

// /me is a cheap read — just needs the general API cap
const apiLimiter = rateLimiter({
  max:      IS_PROD ? 200 : 1000, // generous in dev
  windowMs: 60_000,               // 1 minute
  keyBy:    "ip",
});

// ── API routes ────────────────────────────────────────────────────────────────
// Apply the write limiter only to login/register; /me uses the general limiter
app.use("/api/auth/register", authWriteLimiter);
app.use("/api/auth/login",    authWriteLimiter);
app.use("/api/auth",         apiLimiter,  authRoutes);
app.use("/api/sessions",    apiLimiter,  sessionRoutes);
app.use("/api/reports",     apiLimiter,  reportRoutes);
app.use("/api/history",     apiLimiter,  historyRoutes);
app.use("/api/topics",      apiLimiter,  topicRoutes);
app.use("/api/chat",        apiLimiter,  chatRoutes);
app.use("/api/peer-ratings",apiLimiter,  peerRatingRoutes);
app.use("/api/ai-session",  apiLimiter,  aiSessionRoutes);
app.use("/api/admin",       apiLimiter,  adminRoutes);
app.use("/api/notifications", apiLimiter, notificationRoutes);

// ── ElevenLabs TTS proxy ──────────────────────────────────────────────────────
// Keeps the ElevenLabs API key server-side; client calls /api/tts.
// Key is resolved dynamically from the DB (apiKeyService) with .env fallback.
app.post("/api/tts", apiLimiter, async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });

  const keyInfo = await apiKeyService.getKey("elevenlabs").catch(() => null);
  if (!keyInfo) {
    return res.status(200).json({ fallback: true, reason: "ElevenLabs API key not configured." });
  }

  const vid = voiceId || process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
  const start = Date.now();
  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}`,
      {
        text,
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      },
      {
        headers: {
          "xi-api-key": keyInfo.value,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        responseType: "arraybuffer",
        timeout: 30000,
      }
    );
    await apiKeyService.reportSuccess("elevenlabs", keyInfo.id, { latency: Date.now() - start, endpoint: "tts" });
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(response.data));
  } catch (err) {
    console.error("[tts]", err.message);
    await apiKeyService.reportFailure("elevenlabs", keyInfo.id, {
      error: err.message, endpoint: "tts",
    });
    const status = err.response?.status ?? 502;
    res.status(status).json({ error: "TTS generation failed." });
  }
});

// ── Fluency routes — proxy to FastAPI (port 8000) ─────────────────────────────
const PYTHON_URL = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
const upload = multer({ dest: "uploads/" });

const PYTHON_DOWN_MSG = "The Python analysis server is not running. Start it with: uvicorn main:app --port 8000";

function isPythonDown(err) {
  return err.code === "ECONNREFUSED" || err.code === "ECONNRESET" || err.code === "ENOTFOUND";
}

app.get("/api/fluency/topic", async (_req, res) => {
  try {
    const r = await axios.get(`${PYTHON_URL}/api/fluency/topic`, { timeout: 15000 });
    res.json(r.data);
  } catch (err) {
    console.error("[fluency] topic:", err.message);
    const msg = isPythonDown(err) ? PYTHON_DOWN_MSG : (err.response?.data?.error ?? "Failed to generate topic.");
    res.status(502).json({ error: msg });
  }
});

app.post("/api/fluency/upload", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file provided." });
  const filePath = req.file.path;
  try {
    const form = new FormData();
    form.append("audio", createReadStream(filePath), {
      filename:    req.file.originalname ?? "recording.webm",
      contentType: req.file.mimetype    ?? "audio/webm",
    });
    const r = await axios.post(`${PYTHON_URL}/api/fluency/upload`, form, {
      headers:          form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
      timeout:          120_000,
    });
    res.json(r.data);
  } catch (err) {
    console.error("[fluency] upload:", err.message);
    const msg = isPythonDown(err) ? PYTHON_DOWN_MSG : (err.response?.data?.error ?? "Failed to process audio.");
    res.status(isPythonDown(err) ? 503 : (err.response?.status ?? 502)).json({ error: msg });
  } finally {
    unlink(filePath, () => {});
  }
});

app.post("/api/fluency/score", async (req, res) => {
  try {
    const r = await axios.post(`${PYTHON_URL}/api/fluency/score`, req.body, {
      headers: { "Content-Type": "application/json" },
      timeout: 60_000,
    });
    res.json(r.data);
  } catch (err) {
    console.error("[fluency] score:", err.message);
    const msg = isPythonDown(err) ? PYTHON_DOWN_MSG : (err.response?.data?.error ?? "Failed to score fluency.");
    res.status(isPythonDown(err) ? 503 : (err.response?.status ?? 502)).json({ error: msg });
  }
});

// ── Fluency health check — pings a lightweight Python endpoint ───────────────
app.get("/api/fluency/health", async (_req, res) => {
  try {
    await axios.get(`${PYTHON_URL}/health`, { timeout: 4000 });
    res.json({ online: true });
  } catch {
    res.status(503).json({ online: false, message: "The Python analysis server is not running. Start it with: uvicorn main:app --port 8000" });
  }
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Endpoint not found." });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Catches any error thrown inside route handlers
app.use((err, req, res, _next) => {
  const status  = err.status ?? err.statusCode ?? 500;
  const message = IS_PROD && status === 500
    ? "Internal server error."
    : (err.message ?? "Internal server error.");

  console.error(
    `[error] #${req.requestId ?? "?"} ${req.method} ${req.path} → ${status}: ${err.message}`
  );

  res.status(status).json({ success: false, message });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin:      CLIENT_ORIGINS,
    methods:     ["GET", "POST"],
    credentials: true,
  },
  transports:          ["websocket", "polling"],
  pingTimeout:         20000,
  pingInterval:        25000,
  maxHttpBufferSize:   1e6, // 1 MB max message size
  connectTimeout:      10000,
});

// ── Socket.io JWT middleware ───────────────────────────────────────────────────
// Verify the JWT token sent in the socket handshake auth object.
// Authenticated sockets get socket.data.user = { id, name, email }.
// Unauthenticated sockets are allowed but socket.data.user stays null,
// so they can still participate as guests (name comes from join-session).
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET ?? "fallback_secret");
      socket.data.user = payload; // { id, name, email }
    } catch {
      // Invalid token — treat as unauthenticated guest
      socket.data.user = null;
    }
  } else {
    socket.data.user = null;
  }
  next(); // always allow connection
});

// Attach io instance to app so routes can emit events if needed
app.set("io", io);

io.on("connection", (socket) => {
  registerSocketHandlers(io, socket);
});

// Log active socket count every 60s in dev
if (!IS_PROD) {
  setInterval(() => {
    const count = io.engine.clientsCount;
    if (count > 0) console.log(`[ws] Active connections: ${count}`);
  }, 60_000);
}

// ── Scheduled notification processor ─────────────────────────────────────────
// Runs every 10 seconds to catch notifications whose scheduledAt time has passed.
// Also runs once immediately on startup to catch any missed notifications.
async function processScheduledNotifications() {
  try {
    const now = new Date();
    const due = await Notification.find({ status: "scheduled", scheduledAt: { $lte: now } });
    if (!due.length) return;

    console.log(`[scheduler] Found ${due.length} due notification(s) at ${now.toISOString()}`);

    for (const notif of due) {
      // Mark as sent immediately to prevent double-delivery on concurrent runs
      notif.status = "sent";
      notif.sentAt = now;
      await notif.save();

      const userFilter =
        notif.targetType === "plan"     && notif.targetPlan            ? { plan: notif.targetPlan } :
        notif.targetType === "role"     && notif.targetRole            ? { role: notif.targetRole } :
        notif.targetType === "specific" && notif.targetUsers?.length   ? { _id: { $in: notif.targetUsers } } :
        {};

      const users = await UserModel.find(userFilter).select("_id").lean();

      if (users.length) {
        const docs = users.map((u) => ({ userId: u._id, notificationId: notif._id, deliveredAt: now }));
        await UserNotification.insertMany(docs, { ordered: false }).catch(() => {});

        const payload = {
          id: notif._id, title: notif.title, message: notif.message,
          type: notif.type, priority: notif.priority,
          isBanner: notif.isBanner, isDismissible: notif.isDismissible,
          actionUrl: notif.actionUrl, actionLabel: notif.actionLabel, sentAt: now,
        };

        if (notif.targetType === "all") {
          io.emit("notification", payload);
        } else {
          const userIds = new Set(users.map((u) => u._id.toString()));
          for (const [, socket] of io.sockets.sockets) {
            const uid = socket.data?.user?.id;
            if (uid && userIds.has(uid)) socket.emit("notification", payload);
          }
        }
      }

      notif.sentCount = users.length;
      await notif.save();

      console.log(`[scheduler] ✓ Sent: "${notif.title}" (scheduledAt: ${notif.sentAt?.toISOString()}) → ${users.length} users`);
    }
  } catch (err) {
    console.error("[scheduler] Error:", err.message);
  }
}

// Run every 10 seconds
setInterval(processScheduledNotifications, 10_000);
// Also run once after DB connects (slight delay to ensure connection is ready)
setTimeout(processScheduledNotifications, 3_000);

// ── Start server ──────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  const line = "═".repeat(50);
  console.log(`\n╔${line}╗`);
  console.log(`║${"  INTELLI BOT Backend — All Modules Integrated".padEnd(50)}║`);
  console.log(`╠${line}╣`);
  console.log(`║  REST   →  http://localhost:${PORT}/api${"".padEnd(18)}║`);
  console.log(`║  WS     →  ws://localhost:${PORT}${"".padEnd(21)}║`);
  console.log(`║  Health →  http://localhost:${PORT}/health${"".padEnd(15)}║`);
  console.log(`║  Map    →  http://localhost:${PORT}/api${"".padEnd(18)}║`);
  console.log(`╚${line}╝\n`);

  console.log(`  env:     ${IS_PROD ? "production" : "development"}`);
  console.log(`  origins: ${CLIENT_ORIGINS.join(", ")}`);
  console.log(`  mongodb: ${process.env.MONGODB_URI ? "✓ configured" : "✗ not set"}`);
  console.log(`  gemini:  ${process.env.GEMINI_API_KEY ? "✓ set" : "✗ not set (local fallback)"}`);
  console.log(`  jwt:     ${process.env.JWT_SECRET ? "✓ set" : "⚠ using fallback secret"}`);
  console.log(`  fluency: ${process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000"} (FastAPI)`);
  console.log(`  limits:  auth-write=${IS_PROD ? 20 : 100}/15min  api=${IS_PROD ? 200 : 1000}/min\n`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[server] ${signal} received — shutting down gracefully…`);

  // Stop accepting new connections
  httpServer.close(async () => {
    console.log("[server] HTTP server closed");

    // Close all Socket.io connections
    io.close(() => console.log("[server] Socket.io closed"));

    // Close MongoDB connection
    try {
      const { mongoose } = await import("./db.js");
      await mongoose.connection.close();
      console.log("[server] MongoDB connection closed");
    } catch {}

    console.log("[server] Shutdown complete");
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error("[server] Forced exit after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// ── Unhandled rejection / exception guards ────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err.message);
  if (IS_PROD) process.exit(1);
});
