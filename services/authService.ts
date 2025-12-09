import supabase from './supabaseClient';

export const authService = {
  getCurrentUser: async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  register: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Erro ao criar usuario.');
    return data.user;
  },

  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.user;
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  sendVerificationCode: async (email: string): Promise<string> => {
    return new Promise((resolve) => setTimeout(() => resolve('123456'), 1000));
  },
};
