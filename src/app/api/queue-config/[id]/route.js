import { NextResponse } from 'next/server';
import QueueConfig from '@/models/QueueConfig';
import { verifyAdmin } from '@/lib/supabase';
import { validate, updateQueueConfigSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

// PUT /api/queue-config/[id] — Toggle queue active state (admin only)
export async function PUT(request, { params }) {
  try {
    await verifyAdmin(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = validate(updateQueueConfigSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    let result;
    if (parsed.data.is_active !== undefined) {
      result = await QueueConfig.toggleActive(id, parsed.data.is_active);
    } else if (parsed.data.current_serving !== undefined) {
      result = await QueueConfig.updateCurrentServing(id, parsed.data.current_serving);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
