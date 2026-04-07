import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/supabase';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

function generateKioskToken() {
  const secret = process.env.KIOSK_SECRET;
  if (!secret) throw new Error('KIOSK_SECRET is not configured');

  // Token is an HMAC of today's date — automatically invalidates at midnight
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  return createHmac('sha256', secret).update(`kiosk-${today}`).digest('hex');
}

// POST /api/kiosk/authorize — Set kiosk cookie on this browser (admin only)
export async function POST(request) {
  try {
    await verifyAdmin(request);

    const token = generateKioskToken();

    const response = NextResponse.json({ authorized: true });

    response.cookies.set('kiosk_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
