import { NextResponse } from 'next/server';
import queueController from '@/controllers/queueController';

export const dynamic = 'force-dynamic';

// POST /api/queue — Register a student in the queue
export async function POST(request) {
  try {
    const body = await request.json();
    const { schedule_id, course_id, year_level, enrollment_type, student_name, student_id } = body;

    if (!schedule_id || !course_id || !year_level || !enrollment_type || !student_name || !student_id) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const entry = await queueController.registerStudent(body);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/queue — Get all queues overview
export async function GET() {
  try {
    const queues = await queueController.getAllQueues();
    return NextResponse.json(queues);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
