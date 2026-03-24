// Simple in-memory rate limiter
// Works great for single-instance deployments (Vercel serverless, local dev)
// For multi-instance production, upgrade to Upstash Redis

const store = new Map();

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.windowStart > entry.windowMs) {
      store.delete(key);
    }
  }
}, 60_000);

/**
 * @param {Object} options
 * @param {number} options.maxRequests - Max requests allowed per window
 * @param {number} options.windowMs - Window size in milliseconds
 * @returns {function(string): {allowed: boolean, remaining: number, retryAfterMs: number}}
 */
export function createRateLimiter({ maxRequests = 2, windowMs = 10_000 } = {}) {
  return function checkLimit(identifier) {
    const now = Date.now();
    const entry = store.get(identifier);

    // First request or window expired — reset
    if (!entry || now - entry.windowStart > windowMs) {
      store.set(identifier, { windowStart: now, count: 1, windowMs });
      return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
    }

    // Within window
    if (entry.count < maxRequests) {
      entry.count++;
      return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 };
    }

    // Rate limited
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfterMs };
  };
}

/**
 * Extract client IP from Next.js request headers
 */
export function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}
