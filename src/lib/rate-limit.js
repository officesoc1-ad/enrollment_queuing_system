// In-memory sliding-window rate limiter for Edge Middleware
// Uses a Map keyed by IP to track request timestamps within a rolling window.
// This runs at the Edge (middleware), so blocked requests NEVER consume
// a Serverless Function invocation — saving Vercel and Supabase quotas.

const ipHits = new Map();

// Periodic cleanup to prevent memory leaks — remove entries older than the window
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanup(windowMs) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [ip, timestamps] of ipHits.entries()) {
    const filtered = timestamps.filter(t => t > cutoff);
    if (filtered.length === 0) {
      ipHits.delete(ip);
    } else {
      ipHits.set(ip, filtered);
    }
  }
}

/**
 * Check if an IP is within the rate limit.
 * @param {string} ip - The client IP address
 * @param {number} maxRequests - Maximum requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function rateLimit(ip, maxRequests, windowMs) {
  const now = Date.now();
  cleanup(windowMs);

  const key = ip || 'unknown';
  const timestamps = ipHits.get(key) || [];

  // Remove timestamps outside the current window
  const cutoff = now - windowMs;
  const recent = timestamps.filter(t => t > cutoff);

  if (recent.length >= maxRequests) {
    // Rate limited — calculate when the oldest request in the window expires
    const oldestInWindow = recent[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  // Allow the request and record the timestamp
  recent.push(now);
  ipHits.set(key, recent);

  return { allowed: true, remaining: maxRequests - recent.length, retryAfterMs: 0 };
}
