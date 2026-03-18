import { supabase, getServiceSupabase } from '@/lib/supabase';

const Course = {
  async getAll() {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('code');
    if (error) throw error;
    return data;
  },

  async create(code, name) {
    const { data, error } = await getServiceSupabase()
      .from('courses')
      .insert({ code, name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await getServiceSupabase()
      .from('courses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export default Course;
