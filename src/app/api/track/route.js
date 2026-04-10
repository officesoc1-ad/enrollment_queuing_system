import { NextResponse } from 'next/server';
import QueueEntry from '@/models/QueueEntry';
import { verifyTurnstile } from '@/lib/turnstile';

export const dynamic = 'force-dynamic';

// GET /api/track?student_id=...&turnstile_token=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id');
    const turnstile_token = searchParams.get('turnstile_token');

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
    }

    // Verify Turnstile token before querying
    try {
      await verifyTurnstile(turnstile_token);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    const entry = await QueueEntry.findByStudentId(student_id);
    
    if (!entry) {
      return NextResponse.json({ error: 'No active queue found for this Student ID' }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
