import { NextResponse } from 'next/server';
import scheduleController from '@/controllers/scheduleController';
import { verifyAdmin } from '@/lib/supabase';
import { validate, createScheduleSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

// GET /api/schedules — Get all schedules (public, cached 60s)
export async function GET() {
  try {
    const schedules = await scheduleController.getAllSchedules();
    return NextResponse.json(schedules, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/schedules — Create a new schedule (admin only)
export async function POST(request) {
  try {
    await verifyAdmin(request);

    const body = await request.json();
    const parsed = validate(createScheduleSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const schedule = await scheduleController.createSchedule(parsed.data);
    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/schedules — Delete all schedules (admin only)
export async function DELETE(request) {
  try {
    await verifyAdmin(request);
    await scheduleController.deleteAllSchedules();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
