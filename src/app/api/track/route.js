import { NextResponse } from 'next/server';
import QueueEntry from '@/models/QueueEntry';

export const dynamic = 'force-dynamic';

// GET /api/track?student_id=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id');

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
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
