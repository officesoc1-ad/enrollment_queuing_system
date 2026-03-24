import { NextResponse } from 'next/server';
import Course from '@/models/Course';
import { verifyAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// DELETE /api/courses/[id] — Delete a course (admin only)
export async function DELETE(request, { params }) {
  try {
    await verifyAdmin(request);
    const { id } = await params;
    await Course.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
