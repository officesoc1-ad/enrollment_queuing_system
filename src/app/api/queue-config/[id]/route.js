import { NextResponse } from 'next/server';
import QueueConfig from '@/models/QueueConfig';

export const dynamic = 'force-dynamic';

// PUT /api/queue-config/[id] — Toggle queue active state
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    let result;
    if (body.is_active !== undefined) {
      result = await QueueConfig.toggleActive(id, body.is_active);
    } else if (body.current_serving !== undefined) {
      result = await QueueConfig.updateCurrentServing(id, body.current_serving);
    } else {
      return NextResponse.json({ error: 'No valid update field provided' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
