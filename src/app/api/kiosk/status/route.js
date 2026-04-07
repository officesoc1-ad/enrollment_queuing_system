import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

function isValidKioskToken(token) {
  const secret = process.env.KIOSK_SECRET;
  if (!secret || !token) return false;

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  const expected = createHmac('sha256', secret).update(`kiosk-${today}`).digest('hex');

  return token === expected;
}

// GET /api/kiosk/status — Check if current browser has a valid kiosk cookie
export async function GET(request) {
  const token = request.cookies.get('kiosk_token')?.value;
  const authorized = isValidKioskToken(token);
  return NextResponse.json({ authorized });
}
