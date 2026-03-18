import { supabase, getServiceSupabase } from '@/lib/supabase';

const QueueEntry = {
  async create({ schedule_id, course_id, year_level, enrollment_type, student_name, student_id }) {
    // Get the next queue number for this specific group
    const { data: maxEntry, error: maxError } = await supabase
      .from('queue_entries')
      .select('queue_number')
      .eq('schedule_id', schedule_id)
      .eq('course_id', course_id)
      .eq('year_level', year_level)
      .eq('enrollment_type', enrollment_type)
      .order('queue_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) throw maxError;

    const nextNumber = (maxEntry?.queue_number || 0) + 1;

    const { data, error } = await getServiceSupabase()
      .from('queue_entries')
      .insert({
        schedule_id,
        course_id,
        year_level,
        enrollment_type,
        student_name,
        student_id,
        queue_number: nextNumber,
        status: 'waiting'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('queue_entries')
      .select(`
        *,
        courses:course_id (code, name),
        enrollment_schedules:schedule_id (schedule_date, start_time, end_time, enrollment_type, is_active)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByGroup(schedule_id, course_id, year_level, enrollment_type) {
    const { data, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('schedule_id', schedule_id)
      .eq('course_id', course_id)
      .eq('year_level', year_level)
      .eq('enrollment_type', enrollment_type)
      .order('queue_number');
    if (error) throw error;
    return data;
  },

  async updateStatus(id, status) {
    const { data, error } = await getServiceSupabase()
      .from('queue_entries')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getNextWaiting(schedule_id, course_id, year_level, enrollment_type) {
    const { data, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('schedule_id', schedule_id)
      .eq('course_id', course_id)
      .eq('year_level', year_level)
      .eq('enrollment_type', enrollment_type)
      .eq('status', 'waiting')
      .order('queue_number')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getCountByStatus(schedule_id, course_id, year_level, enrollment_type) {
    const { data, error } = await supabase
      .from('queue_entries')
      .select('status')
      .eq('schedule_id', schedule_id)
      .eq('course_id', course_id)
      .eq('year_level', year_level)
      .eq('enrollment_type', enrollment_type);
    if (error) throw error;

    const counts = { waiting: 0, serving: 0, completed: 0, skipped: 0 };
    data.forEach(entry => { counts[entry.status]++; });
    return counts;
  },

  async getPositionInQueue(id) {
    // First get the entry details
    const entry = await this.getById(id);
    if (!entry) return null;

    // Count how many waiting entries are ahead (lower queue number)
    const { count, error } = await supabase
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('schedule_id', entry.schedule_id)
      .eq('course_id', entry.course_id)
      .eq('year_level', entry.year_level)
      .eq('enrollment_type', entry.enrollment_type)
      .eq('status', 'waiting')
      .lt('queue_number', entry.queue_number);
    if (error) throw error;

    return {
      entry,
      position: count + 1,
      aheadCount: count
    };
  }
};

export default QueueEntry;
