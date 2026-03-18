import { NextResponse } from 'next/server';
import QueueEntry from '@/models/QueueEntry';

export const dynamic = 'force-dynamic';

// GET /api/queue-entries?schedule_id=...&course_id=...&year_level=...&enrollment_type=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const schedule_id = searchParams.get('schedule_id');
    const course_id = searchParams.get('course_id');
    const year_level = searchParams.get('year_level');
    const enrollment_type = searchParams.get('enrollment_type');

    if (!schedule_id || !course_id || !year_level || !enrollment_type) {
      return NextResponse.json({ error: 'schedule_id, course_id, year_level, and enrollment_type are required' }, { status: 400 });
    }

    const entries = await QueueEntry.getByGroup(schedule_id, course_id, parseInt(year_level), enrollment_type);
    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
