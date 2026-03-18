import { NextResponse } from 'next/server';
import scheduleController from '@/controllers/scheduleController';

export const dynamic = 'force-dynamic';

// PUT /api/schedules/[id] — Update a schedule
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const schedule = await scheduleController.updateSchedule(id, body);
    return NextResponse.json(schedule);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/schedules/[id] — Delete a schedule
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await scheduleController.deleteSchedule(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
