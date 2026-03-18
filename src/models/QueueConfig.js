import { supabase, getServiceSupabase } from '@/lib/supabase';

const QueueConfig = {
  async getOrCreate(schedule_id, course_id, year_level, enrollment_type) {
    // Try to find existing config
    const { data: existing, error: findError } = await supabase
      .from('queue_configs')
      .select('*')
      .eq('schedule_id', schedule_id)
      .eq('course_id', course_id)
      .eq('year_level', year_level)
      .eq('enrollment_type', enrollment_type)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return existing;

    // Create new config
    const { data, error } = await getServiceSupabase()
      .from('queue_configs')
      .insert({ schedule_id, course_id, year_level, enrollment_type, current_serving: 0, is_active: false })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('queue_configs')
      .select(`
        *,
        courses:course_id (code, name),
        enrollment_schedules:schedule_id (schedule_date, start_time, end_time, enrollment_type, year_level, is_active)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getBySchedule(schedule_id) {
    const { data, error } = await supabase
      .from('queue_configs')
      .select(`
        *,
        courses:course_id (code, name)
      `)
      .eq('schedule_id', schedule_id)
      .order('year_level')
      .order('created_at');
    if (error) throw error;
    return data;
  },

  async getAllActive() {
    const { data, error } = await supabase
      .from('queue_configs')
      .select(`
        *,
        courses:course_id (code, name),
        enrollment_schedules:schedule_id (schedule_date, start_time, end_time, enrollment_type, year_level, is_active)
      `)
      .eq('is_active', true)
      .order('year_level');
    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await supabase
      .from('queue_configs')
      .select(`
        *,
        courses:course_id (code, name),
        enrollment_schedules:schedule_id (schedule_date, start_time, end_time, enrollment_type, year_level, is_active)
      `)
      .order('year_level');
    if (error) throw error;
    return data;
  },

  async updateCurrentServing(id, number) {
    const { data, error } = await getServiceSupabase()
      .from('queue_configs')
      .update({ current_serving: number })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleActive(id, is_active) {
    const { data, error } = await getServiceSupabase()
      .from('queue_configs')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export default QueueConfig;
