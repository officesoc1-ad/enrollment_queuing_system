import { NextResponse } from 'next/server';
import Course from '@/models/Course';

export const dynamic = 'force-dynamic';

// DELETE /api/courses/[id] — Delete a course
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await Course.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
