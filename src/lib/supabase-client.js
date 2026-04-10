/**
 * Client-side Supabase helper for direct reads.
 * 
 * This module provides functions to read data directly from Supabase
 * on the client side, bypassing Vercel API routes entirely.
 * Used by Queue Board and Admin Dashboard to avoid function invocations
 * when Realtime events trigger data refreshes.
 */
import { supabase } from '@/lib/supabase';

/**
 * Fetch all queue configs with their associated course/schedule info and entry counts.
 * Mirrors the data shape returned by GET /api/queue (QueueConfig.getAll + counts).
 */
export async function fetchQueuesDirectly() {
  // 1. Fetch all queue configs with course and schedule info
  const { data: configs, error: configError } = await supabase
    .from('queue_configs')
    .select(`
      *,
      courses:course_id (code, name),
      enrollment_schedules:schedule_id (schedule_date, start_time, end_time, enrollment_type, year_level)
    `)
    .order('year_level');

  if (configError) throw configError;

  // 2. For each config, get entry counts by status
  const queuesWithCounts = await Promise.all(
    configs.map(async (config) => {
      const { data: entries, error: entryError } = await supabase
        .from('queue_entries')
        .select('status')
        .eq('schedule_id', config.schedule_id)
        .eq('course_id', config.course_id)
        .eq('year_level', config.year_level)
        .eq('enrollment_type', config.enrollment_type);

      if (entryError) throw entryError;

      const counts = { waiting: 0, serving: 0, completed: 0, skipped: 0 };
      entries.forEach(e => { counts[e.status]++; });

      return { ...config, counts };
    })
  );

  return queuesWithCounts;
}

/**
 * Fetch queue entries for a specific queue config.
 * Mirrors the data shape returned by GET /api/queue-entries (QueueEntry.getByGroup).
 */
export async function fetchQueueEntriesDirectly({ schedule_id, course_id, year_level, enrollment_type }) {
  const { data, error } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('schedule_id', schedule_id)
    .eq('course_id', course_id)
    .eq('year_level', year_level)
    .eq('enrollment_type', enrollment_type)
    .order('queue_number', { ascending: true });

  if (error) throw error;
  return data;
}
