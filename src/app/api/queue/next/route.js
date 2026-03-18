import { NextResponse } from 'next/server';
import queueController from '@/controllers/queueController';

export const dynamic = 'force-dynamic';

// POST /api/queue/next — Call next student in a queue
export async function POST(request) {
  try {
    const { configId } = await request.json();
    if (!configId) {
      return NextResponse.json({ error: 'configId is required' }, { status: 400 });
    }

    const result = await queueController.callNext(configId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
