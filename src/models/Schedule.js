import { supabase, getServiceSupabase } from '@/lib/supabase';

const Schedule = {
  async getAll() {
    const { data, error } = await supabase
      .from('enrollment_schedules')
      .select('*, courses:course_id (code, name)')
      .order('schedule_date')
      .order('start_time');
    if (error) throw error;
    return data;
  },

  async getActive() {
    const { data, error } = await supabase
      .from('enrollment_schedules')
      .select('*, courses:course_id (code, name)')
      .eq('is_active', true)
      .order('start_time');
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('enrollment_schedules')
      .select('*, courses:course_id (code, name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create({ course_id, enrollment_type, year_level, schedule_date, start_time, end_time }) {
    const { data, error } = await getServiceSupabase()
      .from('enrollment_schedules')
      .insert({ course_id, enrollment_type, year_level, schedule_date, start_time, end_time })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await getServiceSupabase()
      .from('enrollment_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await getServiceSupabase()
      .from('enrollment_schedules')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getByDateAndType(schedule_date, enrollment_type) {
    const { data, error } = await supabase
      .from('enrollment_schedules')
      .select('*')
      .eq('schedule_date', schedule_date)
      .eq('enrollment_type', enrollment_type)
      .order('start_time');
    if (error) throw error;
    return data;
  }
};

export default Schedule;
