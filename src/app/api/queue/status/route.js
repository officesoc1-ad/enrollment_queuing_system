import { NextResponse } from 'next/server';
import queueController from '@/controllers/queueController';

export const dynamic = 'force-dynamic';

// POST /api/queue/status — Update queue entry status (complete or skip)
export async function POST(request) {
  try {
    const { entryId, action } = await request.json();
    if (!entryId || !action) {
      return NextResponse.json({ error: 'entryId and action are required' }, { status: 400 });
    }

    let result;
    if (action === 'complete') {
      result = await queueController.completeCurrent(entryId);
    } else if (action === 'skip') {
      result = await queueController.skipCurrent(entryId);
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "complete" or "skip"' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
