import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// Kiosk cookie validation — checks HMAC of today's date
function isValidKioskToken(token) {
  const secret = process.env.KIOSK_SECRET;
  if (!secret || !token) return false;

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  const expected = createHmac('sha256', secret).update(`kiosk-${today}`).digest('hex');

  return token === expected;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Skip static assets, _next, favicon, etc.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|ico|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // --- Kiosk device authorization check ---
  // Block /register page and POST /api/queue for unauthorized devices
  const kioskToken = request.cookies.get('kiosk_token')?.value;
  const isKioskAuthorized = isValidKioskToken(kioskToken);

  // Block registration page and queue board if device is not authorized
  if ((pathname.startsWith('/register') || pathname === '/queue') && !isKioskAuthorized) {
    return NextResponse.redirect(new URL('/?kiosk=unauthorized', request.url));
  }

  // Block queue registration API if device is not authorized
  if (pathname === '/api/queue' && request.method === 'POST' && !isKioskAuthorized) {
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
