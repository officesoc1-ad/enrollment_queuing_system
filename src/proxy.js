import { NextResponse } from 'next/server';

// Terminal mode route enforcement
// Each machine sets NEXT_PUBLIC_TERMINAL_MODE in .env.local to: register | admin | display

const MODE_RULES = {
  register: {
    // Pages the registration terminal can access
    allowedPages: ['/register', '/student'],
    // API routes the registration terminal can access
    allowedApi: ['/api/queue', '/api/courses', '/api/schedules', '/api/queue/'],
    // Where to redirect if accessing a blocked page
    homePage: '/register',
  },
  display: {
    allowedPages: ['/queue', '/track', '/student'],
    allowedApi: ['/api/queue', '/api/track', '/api/queue/'],
    homePage: '/queue',
  },
  // admin mode has no restrictions
};

export function proxy(request) {
  const mode = process.env.NEXT_PUBLIC_TERMINAL_MODE;
  const { pathname } = request.nextUrl;

  // No restrictions if mode is not set or is admin
  if (!mode || mode === 'admin') {
    return NextResponse.next();
  }

  const rules = MODE_RULES[mode];
  if (!rules) {
    // Unknown mode — allow everything to avoid breaking the app
    return NextResponse.next();
  }

  // Skip static assets, _next, favicon, etc.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|ico|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Handle API routes
  if (pathname.startsWith('/api/')) {
    const isAllowed = rules.allowedApi.some(route => pathname.startsWith(route));

    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Access denied for this terminal mode' },
        { status: 403 }
      );
    }

    // For display mode, block all write operations (POST/PUT/DELETE)
    if (mode === 'display') {
      const method = request.method;
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        return NextResponse.json(
          { error: 'This terminal is read-only' },
          { status: 403 }
        );
      }
    }

    return NextResponse.next();
  }

  // Handle page routes
  // Root "/" gets redirected to the terminal's home page
  if (pathname === '/') {
    return NextResponse.redirect(new URL(rules.homePage, request.url));
  }

  const isAllowed = rules.allowedPages.some(page => pathname.startsWith(page));

  if (!isAllowed) {
    return NextResponse.redirect(new URL(rules.homePage, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files
  matcher: ['/((?!_next/static|_next/image).*)'],
};
