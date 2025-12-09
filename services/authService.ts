import supabase from './supabaseClient';

const checkSupabase = () => {
  if (!supabase) {
    throw new Error('❌ Supabase não configurado. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_KEY.');
  }
  return supabase;
};

export const authService = {
  // Get current logged user
  getCurrentUser: async () => {
    try {
      const sb = checkSupabase();
      const { data } = await sb.auth.getUser();
      return data.user;
    } catch (error) {
      console.error('Erro ao obter usuário atual:', error);
      return null;
    }
  },

  // Register - Create new user with email and password
  register: async (email: string, password: string) => {
    try {
      const sb = checkSupabase();
      // 1. Create Auth User
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Erro ao criar usuário.');
      // 2. Do immediate login to establish session
      await sb.auth.signInWithPassword({ email, password });
      return data.user;
    } catch (error) {
      throw error;
    }
  },

  // Login with email and password
  login: async (email: string, password: string) => {
    try {
      const sb = checkSupabase();
      const { data, error } = await sb.auth.signInWithPassword({
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
      const sb = checkSupabase();
      const { error } = await sb.auth.signOut();
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },
};

export default authService;
