/**
 * rateLimiter.js — Simple in-memory rate limiter middleware.
 *
 * Limits requests per IP per time window.
 * Uses a Map so it works without Redis for single-instance deployments.
 *
 * Usage:
 *   app.use("/api/auth", rateLimiter({ max: 10, windowMs: 60_000 }), authRoutes);
 */

const store = new Map(); // key → { count, resetAt }

/**
 * @param {object} options
 * @param {number} options.max        — max requests per window (default 100)
 * @param {number} options.windowMs   — window in ms (default 60_000 = 1 min)
 * @param {string} [options.message]  — error message
 * @param {string} [options.keyBy]    — "ip" | "user" (default "ip")
 */
export function rateLimiter({
  max       = 100,
  windowMs  = 60_000,
  message   = "Too many requests. Please try again later.",
  keyBy     = "ip",
} = {}) {
  // Cleanup stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 5 * 60_000);

  return (req, res, next) => {
    const key = keyBy === "user" && req.user
      ? `user:${req.user.id}`
      : `ip:${req.ip}`;

    const now   = Date.now();
    const entry = store.get(key) ?? { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count   = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count++;
    store.set(key, entry);

    // Set standard rate-limit headers
    res.setHeader("X-RateLimit-Limit",     max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.count));
    res.setHeader("X-RateLimit-Reset",     Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      return res.status(429).json({ success: false, message });
    }

    next();
  };
}
