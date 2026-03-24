import { NextResponse } from 'next/server';
import queueController from '@/controllers/queueController';
import { verifyAdmin } from '@/lib/supabase';
import { validate, callNextSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

// POST /api/queue/next — Call next student in a queue (admin only)
export async function POST(request) {
  try {
    await verifyAdmin(request);

    const body = await request.json();
    const parsed = validate(callNextSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await queueController.callNext(parsed.data.configId);
    return NextResponse.json(result);
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
