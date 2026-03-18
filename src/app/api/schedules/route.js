import { NextResponse } from 'next/server';
import scheduleController from '@/controllers/scheduleController';

export const dynamic = 'force-dynamic';

// GET /api/schedules — Get all schedules
export async function GET() {
  try {
    const schedules = await scheduleController.getAllSchedules();
    return NextResponse.json(schedules);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/schedules — Create a new schedule
export async function POST(request) {
  try {
    const body = await request.json();
    const { enrollment_type, year_level, schedule_date, start_time, end_time } = body;

    if (!enrollment_type || !year_level || !schedule_date || !start_time || !end_time) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const schedule = await scheduleController.createSchedule(body);
    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
