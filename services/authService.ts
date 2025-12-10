
import supabase, { isSupabaseConfigured } from './supabaseClient';

const MOCK_USER_KEY = 'caixinha_mock_user';

export const authService = {
  getCurrentUser: async () => {
    // Se Supabase não estiver configurado, usa sessão local simulada
    if (!isSupabaseConfigured || !supabase) {
        const stored = localStorage.getItem(MOCK_USER_KEY);
        return stored ? JSON.parse(stored) : null;
    }
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  register: async (email: string, password: string) => {
    // MOCK REGISTER
    if (!isSupabaseConfigured || !supabase) {
        const newUser = { 
            id: 'mock-user-' + Math.random().toString(36).substr(2, 9),
            email 
        };
        localStorage.setItem(MOCK_USER_KEY, JSON.stringify(newUser));
        return newUser;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}` },
    });

    if (error) throw error;
    
    // Check if session is missing (implies email confirmation is on)
    if (data.user && !data.session) {
        throw new Error("CONFIRM_EMAIL_REQUIRED");
    }

    if (!data.user) throw new Error("Erro ao criar usuário.");

    return data.user;
  },

  login: async (email: string, password: string) => {
    // MOCK LOGIN
    if (!isSupabaseConfigured || !supabase) {
        // Aceita qualquer login para demonstração
        const user = { 
            id: 'mock-user-demo',
            email 
        };
        localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
        return user;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data.user;
  },

  logout: async () => {
    if (!isSupabaseConfigured || !supabase) {
        localStorage.removeItem(MOCK_USER_KEY);
        return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  sendVerificationCode: async (email: string): Promise<string> => {
    return new Promise((resolve) => setTimeout(() => resolve('123456'), 1000));
  }
};
