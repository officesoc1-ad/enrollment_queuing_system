import { z } from 'zod';

// Reusable UUID validator
const uuid = z.string().uuid('Invalid UUID format');

// Schedule validation
export const createScheduleSchema = z.object({
  course_id: uuid,
  enrollment_type: z.enum(['block_section', 'irregular'], { message: 'Must be "block_section" or "irregular"' }),
  year_level: z.number().int().min(1).max(4, 'Year level must be between 1 and 4'),
  schedule_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM format'),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM format')
});

export const updateScheduleSchema = createScheduleSchema.partial();

// Course validation
export const createCourseSchema = z.object({
  code: z.string().min(2, 'Course code is required').max(20),
  name: z.string().min(2, 'Course name is required').max(100)
});

// Queue registration validation
export const joinQueueSchema = z.object({
  schedule_id: uuid,
  course_id: uuid,
  year_level: z.number().int().min(1).max(4),
  enrollment_type: z.enum(['block_section', 'irregular']),
  student_name: z.string().min(1, 'Student name is required').max(100),
  student_id: z.string().regex(/^\d{8}$/, 'Student ID must be exactly 8 digits'),
  turnstileToken: z.string().min(1, 'Bot verification is required'),
  latitude: z.number().min(-90).max(90, 'Invalid latitude'),
  longitude: z.number().min(-180).max(180, 'Invalid longitude')
});

// Queue management validation
export const callNextSchema = z.object({
  configId: uuid
});

export const statusChangeSchema = z.object({
  entryId: uuid,
  action: z.enum(['complete', 'skip'], { message: 'Action must be "complete" or "skip"' })
});

// Helper to validate and return parsed data or error response
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map(i => i.message).join(', ');
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}
