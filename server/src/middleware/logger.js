/**
 * logger.js — Structured request/response logger.
 *
 * Attaches a unique requestId to every request.
 * Logs method, path, status, duration, and user identity.
 */

import { randomUUID } from "crypto";

// ANSI colour helpers (stripped in production if needed)
const c = {
  reset:  "\x1b[0m",
  dim:    "\x1b[2m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  blue:   "\x1b[34m",
};

function statusColor(code) {
  if (code >= 500) return c.red;
  if (code >= 400) return c.yellow;
  if (code >= 300) return c.cyan;
  return c.green;
}

function methodColor(method) {
  const map = { GET: c.blue, POST: c.green, PATCH: c.cyan, PUT: c.cyan, DELETE: c.red };
  return map[method] ?? c.reset;
}

export function requestLogger(req, res, next) {
  req.requestId = randomUUID().slice(0, 8);
  req.startTime = Date.now();

  // Log on response finish
  res.on("finish", () => {
    const ms     = Date.now() - req.startTime;
    const status = res.statusCode;
    const user   = req.user ? `[${req.user.email}]` : "[anon]";
    const rid    = `${c.dim}#${req.requestId}${c.reset}`;

    console.log(
      `${rid} ${methodColor(req.method)}${req.method.padEnd(6)}${c.reset}` +
      ` ${req.path.padEnd(40)}` +
      ` ${statusColor(status)}${status}${c.reset}` +
      ` ${c.dim}${ms}ms ${user}${c.reset}`
    );
  });

  next();
}

/**
 * Structured error logger — call from catch blocks.
 */
export function logError(module, message, err = null) {
  const ts  = new Date().toISOString();
  const detail = err ? ` | ${err.message ?? err}` : "";
  console.error(`${c.red}[${ts}] [${module}] ERROR: ${message}${detail}${c.reset}`);
}

/**
 * Info logger.
 */
export function logInfo(module, message) {
  const ts = new Date().toISOString();
  console.log(`${c.dim}[${ts}]${c.reset} [${module}] ${message}`);
}
