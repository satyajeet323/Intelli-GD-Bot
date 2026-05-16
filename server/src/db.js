/**
 * db.js — MongoDB connection via Mongoose with auto-retry.
 */

import mongoose from "mongoose";

let isConnected = false;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("[db] MONGODB_URI not set — running without database");
    return;
  }

  if (isConnected) return;

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,  // 30s — Atlas free tier can be slow to wake
      connectTimeoutMS:         30000,
      socketTimeoutMS:          60000,
      maxPoolSize:              10,
      retryWrites:              true,
    });

    isConnected = true;
    console.log("[db] ✓ MongoDB Atlas connected");

    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      console.warn("[db] Disconnected — will reconnect automatically");
    });
    mongoose.connection.on("reconnected", () => {
      isConnected = true;
      console.log("[db] Reconnected");
    });
    mongoose.connection.on("error", (err) => {
      console.error("[db] Error:", err.message);
    });
  } catch (err) {
    console.error("[db] Connection failed:", err.message);
    console.warn("[db] Retrying in 5 seconds…");
    setTimeout(() => connectDB(), 5000);
  }
}

export { mongoose };
