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

/**
 * Fetch a student's queue status directly from Supabase.
 * Replaces polling to /api/queue/[id] — zero Vercel invocations.
 * Returns the same shape as the API: { entry, position, aheadCount, currentServing }
 */
export async function fetchStudentStatusDirectly(entryId) {
  // 1. Get the queue entry with joined course and schedule info
  const { data: entry, error: entryError } = await supabase
    .from('queue_entries')
    .select(`
      *,
      courses:course_id (code, name),
      enrollment_schedules:schedule_id (schedule_date, start_time, end_time, enrollment_type)
    `)
    .eq('id', entryId)
    .single();

  if (entryError) throw entryError;
  if (!entry) throw new Error('Queue entry not found');

  // 2. Count how many waiting entries are ahead (lower queue number)
  const { count, error: countError } = await supabase
    .from('queue_entries')
    .select('*', { count: 'exact', head: true })
    .eq('schedule_id', entry.schedule_id)
    .eq('course_id', entry.course_id)
    .eq('year_level', entry.year_level)
    .eq('enrollment_type', entry.enrollment_type)
    .eq('status', 'waiting')
    .lt('queue_number', entry.queue_number);

  if (countError) throw countError;

  // 3. Get the queue config for current serving number
  const { data: config, error: configError } = await supabase
    .from('queue_configs')
    .select('current_serving')
    .eq('schedule_id', entry.schedule_id)
    .eq('course_id', entry.course_id)
    .eq('year_level', entry.year_level)
    .eq('enrollment_type', entry.enrollment_type)
    .maybeSingle();

  if (configError) throw configError;

  return {
    entry,
    position: count + 1,
    aheadCount: count,
    currentServing: config?.current_serving || 0
  };
}

