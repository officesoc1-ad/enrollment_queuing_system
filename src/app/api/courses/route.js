import { NextResponse } from 'next/server';
import Course from '@/models/Course';

export const dynamic = 'force-dynamic';

// GET /api/courses — Get all courses
export async function GET() {
  try {
    const courses = await Course.getAll();
    return NextResponse.json(courses);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/courses — Create a new course
export async function POST(request) {
  try {
    const { code, name } = await request.json();
    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 });
    }

    const course = await Course.create(code, name);
    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
