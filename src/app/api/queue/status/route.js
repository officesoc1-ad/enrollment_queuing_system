import { NextResponse } from 'next/server';
import queueController from '@/controllers/queueController';
import { verifyAdmin } from '@/lib/supabase';
import { validate, statusChangeSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

// POST /api/queue/status — Update queue entry status (admin only)
export async function POST(request) {
  try {
    await verifyAdmin(request);

    const body = await request.json();
    const parsed = validate(statusChangeSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    let result;
    if (parsed.data.action === 'complete') {
      result = await queueController.completeCurrent(parsed.data.entryId);
    } else if (parsed.data.action === 'skip') {
      result = await queueController.skipCurrent(parsed.data.entryId);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
