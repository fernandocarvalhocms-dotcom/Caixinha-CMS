import supabase from './supabaseClient';

export const authService = {
  // Get current logged user
  getCurrentUser: async () => {
    try {
      const { data } = await supabase.auth.getUser();
      return data.user;
    } catch (error) {
      return null;
    }
  },

  // Register - Create new user with email and password
  register: async (email: string, password: string) => {
    try {
      // 1. Create Auth User
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error('Erro ao criar usuário.');

      // 2. Do immediate login to establish session
        await supabase.auth.signInWithPassword({ email, password });

      return data.user;
    } catch (error) {
      throw error;
    }
  },

  // Login with email and password
  login: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Erro ao fazer login.');

      return data.user;
    } catch (error) {
      throw error;
    }
  },

  // Logout
  logout: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },
};

export default authService;
