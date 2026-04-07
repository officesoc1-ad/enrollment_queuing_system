import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/kiosk/revoke — Clear the kiosk cookie (admin only)
export async function POST(request) {
  try {
    await verifyAdmin(request);

    const response = NextResponse.json({ authorized: false });

    response.cookies.set('kiosk_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0, // Immediately expire
    });

    return response;
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
