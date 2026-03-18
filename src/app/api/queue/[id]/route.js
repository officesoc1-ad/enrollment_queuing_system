import { NextResponse } from 'next/server';
import queueController from '@/controllers/queueController';

export const dynamic = 'force-dynamic';

// GET /api/queue/[id] — Get student status by queue entry ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const status = await queueController.getStudentStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
