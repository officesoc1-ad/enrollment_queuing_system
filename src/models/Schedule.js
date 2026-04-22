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
      .select('*, courses:course_id (code, name)')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await getServiceSupabase()
      .from('enrollment_schedules')
      .update(updates)
      .eq('id', id)
      .select('*, courses:course_id (code, name)')
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { data, error } = await getServiceSupabase()
      .from('enrollment_schedules')
      .delete()
      .eq('id', id)
      .select();
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Schedule not found or already deleted');
    }
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
