-- Run this in the Supabase SQL Editor to implement secure queue numbering
-- This function mathematically prevents two students from getting the same queue number during traffic spikes
-- It also prevents duplicate registrations (same student_id in the same queue)

CREATE OR REPLACE FUNCTION join_queue(
  p_schedule_id UUID,
  p_course_id UUID,
  p_year_level INT,
  p_enrollment_type TEXT,
  p_student_name TEXT,
  p_student_id TEXT
) RETURNS queue_entries AS $$
DECLARE
  v_next_num INT;
  v_entry queue_entries;
  v_existing queue_entries;
BEGIN
  -- 0. Check for duplicate registration (same student in the same queue group, still active)
  SELECT * INTO v_existing
  FROM queue_entries
  WHERE schedule_id = p_schedule_id
    AND course_id = p_course_id
    AND year_level = p_year_level
    AND enrollment_type = p_enrollment_type
    AND student_id = p_student_id
    AND status IN ('waiting', 'serving')
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RAISE EXCEPTION 'DUPLICATE_REGISTRATION:%', v_existing.id;
  END IF;

  -- 1. Lock the queue configuration row using FOR UPDATE
  -- This forces any simultaneous requests for the exact same queue to wait in line.
  PERFORM 1 FROM queue_configs 
  WHERE schedule_id = p_schedule_id 
    AND course_id = p_course_id 
    AND year_level = p_year_level 
    AND enrollment_type = p_enrollment_type
  FOR UPDATE;

  -- 2. Find the current highest queue number for this specific group
  SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_next_num
  FROM queue_entries
  WHERE schedule_id = p_schedule_id 
    AND course_id = p_course_id 
    AND year_level = p_year_level 
    AND enrollment_type = p_enrollment_type;

  -- 3. Insert the new queue entry with the guaranteed unique next number
  INSERT INTO queue_entries (
    schedule_id, 
    course_id, 
    year_level, 
    enrollment_type, 
    student_name, 
    student_id, 
    queue_number, 
    status
  )
  VALUES (
    p_schedule_id, 
    p_course_id, 
    p_year_level, 
    p_enrollment_type, 
    p_student_name, 
    p_student_id, 
    v_next_num, 
    'waiting'
  )
  RETURNING * INTO v_entry;

  -- 4. Return the newly created row safely to the Next.js API
  RETURN v_entry;
END;
$$ LANGUAGE plpgsql;
