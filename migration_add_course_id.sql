-- Run this in the Supabase SQL Editor to update your database schema
-- This adds the 'course_id' to the schedules table so you can link a schedule to a specific course.

-- 1. Add column
ALTER TABLE enrollment_schedules 
ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE CASCADE;

-- 2. Drop the old unique constraint (which only checked year/type/date/time)
ALTER TABLE enrollment_schedules 
DROP CONSTRAINT IF EXISTS enrollment_schedules_enrollment_type_year_level_s_key;

-- 3. Add the new correct unique constraint
ALTER TABLE enrollment_schedules 
ADD UNIQUE (course_id, enrollment_type, year_level, schedule_date, start_time);
