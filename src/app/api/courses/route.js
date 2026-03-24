import { NextResponse } from 'next/server';
import Course from '@/models/Course';
import { verifyAdmin } from '@/lib/supabase';
import { validate, createCourseSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

// GET /api/courses — Get all courses (public, cached 60s)
export async function GET() {
  try {
    const courses = await Course.getAll();
    return NextResponse.json(courses, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/courses — Create a new course (admin only)
export async function POST(request) {
  try {
    await verifyAdmin(request);

    const body = await request.json();
    const parsed = validate(createCourseSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const course = await Course.create(parsed.data.code, parsed.data.name);
    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    if (error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
