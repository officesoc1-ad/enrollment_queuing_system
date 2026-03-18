import { supabase } from '@/lib/supabase';

const adminController = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  async verifySession() {
    const session = await this.getSession();
    if (!session) throw new Error('Not authenticated');
    return session;
  }
};

export default adminController;
