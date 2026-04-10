import { NextResponse } from 'next/server';
import queueController from '@/controllers/queueController';
import { validate, joinQueueSchema } from '@/lib/validators';
import { verifyTurnstile } from '@/lib/turnstile';
import { isWithinCampus } from '@/lib/geofence';

export const dynamic = 'force-dynamic';

// POST /api/queue — Register a student in the queue (public, rate limited + Turnstile + Geofence)
export async function POST(request) {
  try {

    const body = await request.json();

    const parsed = validate(joinQueueSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Verify Turnstile token before processing
    try {
      await verifyTurnstile(parsed.data.turnstileToken);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    // Verify GPS location — must be within campus radius
    const { allowed, distance, maxRadius } = isWithinCampus(parsed.data.latitude, parsed.data.longitude);
    if (!allowed) {
      return NextResponse.json(
        { error: `You must be on campus to register. You appear to be ${distance}m away (max: ${maxRadius}m).` },
        { status: 403 }
      );
    }

    // Strip non-registration fields before passing to the controller
    const { turnstileToken, latitude, longitude, ...registrationData } = parsed.data;

    const entry = await queueController.registerStudent(registrationData);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    // Handle duplicate registration — redirect student to their existing queue
    if (error.message?.includes('DUPLICATE_REGISTRATION')) {
      const existingId = error.message.split('DUPLICATE_REGISTRATION:')[1];
      return NextResponse.json(
        { error: 'You are already registered in this queue.', existingEntryId: existingId },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/queue — Get all queues overview (public)
export async function GET() {
  try {
    const queues = await queueController.getAllQueues();
    return NextResponse.json(queues);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
