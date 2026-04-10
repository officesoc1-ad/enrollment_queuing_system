import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { rateLimit } from '@/lib/rate-limit';

// ============================================
// Rate Limit Tiers
// ============================================
// These define how many requests an IP can make within a given time window.
// Blocked requests are dropped BEFORE reaching Serverless Functions,
// saving both Vercel execution quotas and Supabase API calls.

const RATE_LIMITS = {
  // Public read endpoints (GET /api/queue, GET /api/courses, etc.)
  // Generous limit — these are needed for live page loads
  publicRead: { max: 30, windowMs: 60_000 },    // 30 req / 60s

  // Public write endpoints (POST /api/queue — student registration)
  // Tighter — a student should only register once per session
  publicWrite: { max: 5, windowMs: 60_000 },     // 5 req / 60s

  // Auth endpoints (admin login via Supabase)
  // Tight — prevents brute-force password guessing
  auth: { max: 10, windowMs: 300_000 },          // 10 req / 5 min

  // Track endpoint (GET /api/track — find queue by student ID)
  // Moderate — students may retry a few times
  track: { max: 15, windowMs: 60_000 },          // 15 req / 60s

  // Admin API endpoints (require auth, but still rate-limit)
  admin: { max: 40, windowMs: 60_000 },          // 40 req / 60s
};

// ============================================
// Kiosk Cookie Validation
// ============================================
function isValidKioskToken(token) {
  const secret = process.env.KIOSK_SECRET;
  if (!secret || !token) return false;

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  const expected = createHmac('sha256', secret).update(`kiosk-${today}`).digest('hex');

  return token === expected;
}

// ============================================
// Helper: Create a 429 Too Many Requests response
// ============================================
function rateLimitResponse(retryAfterMs) {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Reset': String(retryAfterSec),
      }
    }
  );
}

// ============================================
// Determine which rate limit tier applies
// ============================================
function getRateLimitTier(pathname, method) {
  // Auth-related
  if (pathname === '/api/admins' && method === 'POST') return 'auth';
  if (pathname.startsWith('/api/admins/') && method === 'DELETE') return 'auth';

  // Track
  if (pathname === '/api/track') return 'track';

  // Public writes (student registration)
  if (pathname === '/api/queue' && method === 'POST') return 'publicWrite';

  // Admin-only API routes (POST/PUT/DELETE on queue management)
  if (pathname.startsWith('/api/queue/next')) return 'admin';
  if (pathname.startsWith('/api/queue/status')) return 'admin';
  if (pathname.startsWith('/api/queue-config')) return 'admin';
  if (pathname.startsWith('/api/schedules') && method !== 'GET') return 'admin';
  if (pathname.startsWith('/api/courses') && method !== 'GET') return 'admin';
  if (pathname.startsWith('/api/kiosk/')) return 'admin';

  // Public reads (GET /api/queue, GET /api/courses, GET /api/schedules, etc.)
  if (pathname.startsWith('/api/')) return 'publicRead';

  // Non-API routes (page navigations) — no rate limit
  return null;
}

// ============================================
// Main Middleware
// ============================================
export function proxy(request) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip static assets, _next, favicon, etc.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|ico|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // --- Rate Limiting ---
  const tier = getRateLimitTier(pathname, method);
  if (tier) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const limits = RATE_LIMITS[tier];
    // Use a compound key so different tiers don't share counters
    const rateLimitKey = `${ip}:${tier}`;
    const { allowed, retryAfterMs } = rateLimit(rateLimitKey, limits.max, limits.windowMs);

    if (!allowed) {
      return rateLimitResponse(retryAfterMs);
    }
  }

  // --- Kiosk device authorization check ---
  const kioskToken = request.cookies.get('kiosk_token')?.value;
  const isKioskAuthorized = isValidKioskToken(kioskToken);

  // Block registration page and queue board if device is not authorized
  if ((pathname.startsWith('/register') || pathname === '/queue') && !isKioskAuthorized) {
    return NextResponse.redirect(new URL('/?kiosk=unauthorized', request.url));
  }

  // Block queue registration API if device is not authorized
  if (pathname === '/api/queue' && method === 'POST' && !isKioskAuthorized) {
    return NextResponse.json(
      { error: 'This device is not authorized for registration. An admin must authorize this device first.' },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files
  matcher: ['/((?!_next/static|_next/image).*)'],
};
