import { NextResponse } from 'next/server';
import scheduleController from '@/controllers/scheduleController';
import { verifyAdmin } from '@/lib/supabase';
import { validate, updateScheduleSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

// PUT /api/schedules/[id] — Update a schedule (admin only)
export async function PUT(request, { params }) {
  try {
    await verifyAdmin(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = validate(updateScheduleSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const schedule = await scheduleController.updateSchedule(id, parsed.data);
    return NextResponse.json(schedule);
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/schedules/[id] — Delete a schedule (admin only)
export async function DELETE(request, { params }) {
  try {
    await verifyAdmin(request);
    const { id } = await params;
    await scheduleController.deleteSchedule(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
