const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const subjectRoutes = require("./routes/subject");
const questionRoutes = require("./routes/question");
const faceRecognitionRoutes = require("./routes/faceRecognition");
const quizRoutes = require("./routes/quiz");
const leaderboardRoutes = require("./routes/leaderboard");
const practicalRoutes = require("./routes/practical");
const mcqRoutes = require("./routes/mcq");

// Import middleware
const { errorHandler } = require("./middleware/errorHandler");
const { authMiddleware } = require("./middleware/auth");

// Middleware to check database connection
const checkDBConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      status: 'error',
      message: 'Database connection unavailable. Please try again later.',
      code: 'DB_UNAVAILABLE'
    });
  }
  next();
};

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Parse allowed origins from env (comma-separated) with sensible dev defaults
const allowedOrigins = process.env.CLIENT_ORIGINS
  ? process.env.CLIENT_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"];

app.use(
  cors({
    origin: process.env.NODE_ENV === "production"
      ? allowedOrigins
      : (origin, cb) => cb(null, true), // allow all in dev
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer setup for file uploads (for network JSON files)
const upload = multer({ dest: "uploads/" });

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/face-recognition", faceRecognitionRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/practical", practicalRoutes);
app.use("/api/mcq", mcqRoutes);

// =============================================================================
// NETWORKING ROUTES - Forward to Flask backend
// =============================================================================

app.post("/api/network/upload", (req, res) => {
  const networkData = req.body;

  if (!networkData || !networkData.nodes || !networkData.edges) {
    return res.status(400).json({ error: "Invalid network JSON format" });
  }

  const savePath = path.join(__dirname, "networkData.json");
  fs.writeFile(savePath, JSON.stringify(networkData, null, 2), (err) => {
    if (err) {
      console.error("Error saving network data:", err);
      return res.status(500).json({ error: "Failed to save network data" });
    }
    res.json({ message: "Network data saved successfully" });
  });
});

app.post("/api/network/evaluate", async (req, res) => {
  const { question, config } = req.body;

  if (!config || !config.nodes || !config.edges) {
    return res
      .status(400)
      .json({ error: "Invalid network JSON format inside config" });
  }

  if (!question) {
    return res.status(400).json({ error: "Missing question in request body" });
  }

  try {
    const flaskResponse = await axios.post(
      "http://localhost:6000/evaluate-network",
      { question, config },
      { headers: { "Content-Type": "application/json" } }
    );

    const evalText = flaskResponse.data?.evaluation ?? flaskResponse.data;
    res.json({ status: "success", evaluation: evalText });
  } catch (error) {
    console.error("Error forwarding to Flask backend:", error.message);
    res.status(500).json({ error: "Failed to evaluate network" });
  }
});

// GET endpoint to get a generated networking question from Flask backend
app.get("/api/network/generate-question", async (req, res) => {
  try {
    const flaskResponse = await axios.get(
      "http://localhost:6000/generate-network-question"
    );

    res.json({ status: "success", question: flaskResponse.data.question });
  } catch (error) {
    console.error(
      "Error fetching generated question from Flask backend:",
      error.message
    );
    res.status(500).json({ error: "Failed to generate question" });
  }
});

// POST endpoint for uploading JSON file (optional)
app.post("/api/network/upload-file", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = path.join(__dirname, req.file.path);
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read uploaded file" });
    }

    try {
      const networkData = JSON.parse(data);

      // Delete temp file
      fs.unlink(filePath, () => {});

      res.json({
        message: "File uploaded and processed successfully",
        networkData,
      });
    } catch (parseErr) {
      return res.status(400).json({ error: "Invalid JSON file" });
    }
  });
});

// =============================================================================
// CODING ROUTES - Forward to Flask backend
// =============================================================================

// Generate coding question
app.get("/api/coding/generate-question", async (req, res) => {
  try {
    const flaskResponse = await axios.get(
      "http://localhost:6000/generate-coding-question"
    );
    res.json({ status: "success", question: flaskResponse.data.question });
  } catch (error) {
    console.error(
      "Error fetching coding question from Flask backend:",
      error.message
    );
    res.status(500).json({ error: "Failed to generate coding question" });
  }
});

// Run and evaluate code
app.post("/api/coding/run", async (req, res) => {
  const { code, language, question } = req.body;

  if (!code || !language || !question) {
    return res.status(400).json({ 
      status: "error",
      error: "Missing code, language, or question" 
    });
  }

  try {
    console.log(`Forwarding code execution request to Flask: ${language}`);
    
    const flaskResponse = await axios.post(
      "http://localhost:6000/run-code",
      { code, language, question },
      { 
        headers: { "Content-Type": "application/json" },
        timeout: 30000 // 30 second timeout
      }
    );

    res.json({
      status: "success",
      output: flaskResponse.data.output,
      ai_feedback: flaskResponse.data.ai_feedback
    });
  } catch (error) {
    console.error("Error forwarding to Flask backend:", error.message);
    
    let errorMessage = "Failed to run code";
    if (error.code === 'ECONNREFUSED') {
      errorMessage = "Code execution service is not available. Please ensure the Flask server is running.";
    } else if (error.code === 'ECONNRESET') {
      errorMessage = "Connection to code execution service was reset. Please try again.";
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    }
    
    res.status(500).json({ 
      status: "error",
      error: errorMessage 
    });
  }
});

// =============================================================================
// SQL ROUTES - Forward to Flask backend
// =============================================================================

// Generate SQL question
app.get("/api/sql/generate-question", async (req, res) => {
  try {
    const flaskResponse = await axios.get(
      "http://localhost:6000/generate-sql-question"
    );
    res.json({ status: "success", data: flaskResponse.data });
  } catch (error) {
    console.error(
      "Error fetching SQL question from Flask backend:",
      error.message
    );
    res.status(500).json({ error: "Failed to generate SQL question" });
  }
});

// Run SQL setup
app.post("/api/sql/run-setup", async (req, res) => {
  const { setup_sql, session_id } = req.body;

  try {
    const flaskResponse = await axios.post(
      "http://localhost:6000/run-setup",
      { setup_sql, session_id },
      { headers: { "Content-Type": "application/json" } }
    );

    res.json({ status: "success", session_id: flaskResponse.data.session_id });
  } catch (error) {
    console.error("Error forwarding to Flask backend:", error.message);
    res.status(500).json({ error: "Failed to run SQL setup" });
  }
});

// Get table data
app.post("/api/sql/get-table", async (req, res) => {
  const { session_id, table_name } = req.body;

  try {
    const flaskResponse = await axios.post(
      "http://localhost:6000/get-table",
      { session_id, table_name },
      { headers: { "Content-Type": "application/json" } }
    );

    res.json({ status: "success", data: flaskResponse.data });
  } catch (error) {
    console.error("Error forwarding to Flask backend:", error.message);
    res.status(500).json({ error: "Failed to get table data" });
  }
});

// Run SQL query
app.post("/api/sql/run-query", async (req, res) => {
  const { session_id, user_query } = req.body;

  try {
    const flaskResponse = await axios.post(
      "http://localhost:6000/run-query",
      { session_id, user_query },
      { headers: { "Content-Type": "application/json" } }
    );

    res.json({
      status: "success",
      columns: flaskResponse.data.columns,
      rows: flaskResponse.data.rows
    });
  } catch (error) {
    console.error("Error forwarding to Flask backend:", error.message);
    res.status(500).json({ error: "Failed to run SQL query" });
  }
});

// Evaluate SQL query
app.post("/api/sql/evaluate", async (req, res) => {
  const { question, setup_sql, user_query, user_output } = req.body;

  try {
    const flaskResponse = await axios.post(
      "http://localhost:6000/evaluate-sql",
      { question, setup_sql, user_query, user_output },
      { headers: { "Content-Type": "application/json" } }
    );

    res.json({ status: "success", evaluation: flaskResponse.data });
  } catch (error) {
    console.error("Error forwarding to Flask backend:", error.message);
    res.status(500).json({ error: "Failed to evaluate SQL query" });
  }
});

// =============================================================================
// FLUENCY ROUTES - Forward to FastAPI backend (port 8000)
// =============================================================================

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

// Generate fluency topic
app.get("/api/fluency/topic", async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/api/fluency/topic`, { timeout: 15000 });
    res.json(response.data);
  } catch (error) {
    console.error("[Fluency] topic error:", error.message);
    res.status(502).json({ error: "Fluency service unavailable. Ensure the Python server is running on port 8000." });
  }
});

// Upload fluency audio — receive multipart, forward to FastAPI
app.post("/api/fluency/upload", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided." });
  }

  const filePath = req.file.path;

  try {
    const FormData = require("form-data");
    const formData = new FormData();
    const fileStream = fs.createReadStream(filePath);
    formData.append("audio", fileStream, {
      filename:    req.file.originalname || `recording.webm`,
      contentType: req.file.mimetype    || "audio/webm",
    });

    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/api/fluency/upload`,
      formData,
      {
        headers:          { ...formData.getHeaders() },
        maxContentLength: Infinity,
        maxBodyLength:    Infinity,
        timeout:          120000, // 2 minutes — Whisper can be slow
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("[Fluency] upload error:", error.message);
    const status = error.response?.status ?? 502;
    const msg    = error.response?.data?.error ?? "Failed to process audio.";
    res.status(status).json({ error: msg });
  } finally {
    // Always clean up the temp file
    fs.unlink(filePath, (err) => {
      if (err) console.error("[Fluency] temp file cleanup failed:", err.message);
    });
  }
});

// Score fluency transcript
app.post("/api/fluency/score", async (req, res) => {
  try {
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/api/fluency/score`,
      req.body,
      { headers: { "Content-Type": "application/json" }, timeout: 60000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error("[Fluency] score error:", error.message);
    const status = error.response?.status ?? 502;
    const msg    = error.response?.data?.error ?? "Failed to score fluency.";
    res.status(status).json({ error: msg });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusMap = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

  res.status(200).json({
    status:    "success",
    message:   "INTELLI BOT API is running",
    timestamp: new Date().toISOString(),
    database: {
      status:    dbStatusMap[dbStatus] || "unknown",
      connected: dbStatus === 1,
    },
    services: {
      api:            "operational",
      fluency_python: "check http://localhost:8000/api/fluency/topic",
      flask:          "check http://localhost:6000",
      database:       dbStatus === 1 ? "operational" : "unavailable",
    },
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

// MongoDB connection with retry logic
const connectDB = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to connect to MongoDB... (Attempt ${i + 1}/${retries})`);
      
      const conn = await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/edubot",
        {
          serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds
          socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        }
      );
      
      console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${i + 1} failed:`, error.message);
      
      if (i === retries - 1) {
        console.error("\n⚠️  MongoDB Connection Failed After All Retries");
        console.error("⚠️  The server will continue running without database functionality");
        console.error("⚠️  Please check:");
        console.error("   1. Your internet connection");
        console.error("   2. MongoDB Atlas cluster is running (not paused)");
        console.error("   3. Your IP address is whitelisted in MongoDB Atlas");
        console.error("   4. The connection string in .env is correct\n");
        return null;
      }
      
      console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Start server
const startServer = async () => {
  const dbConnection = await connectDB();
  
  if (!dbConnection) {
    console.log("⚠️  Starting server without database connection...");
  }
  
  app.listen(PORT, () => {
    console.log(`\n🚀 INTELLI BOT Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🎤 Fluency (FastAPI): http://localhost:8000`);
    console.log(`🔗 Flask backend:     http://localhost:6000`);
    console.log(`💻 Code execution:    http://localhost:${PORT}/api/coding/run`);
    console.log(`🌐 Networking:        http://localhost:${PORT}/api/network/generate-question`);
    console.log(`🗄️  SQL Practice:      http://localhost:${PORT}/api/sql/generate-question\n`);

    if (!dbConnection) {
      console.log("⚠️  WARNING: Server is running without database connection!");
      console.log("⚠️  Authentication and data persistence features will not work.\n");
    }
  });
};

startServer();

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  process.exit(1);
});