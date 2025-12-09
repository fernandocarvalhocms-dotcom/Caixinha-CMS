
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

  register: async (email: string, password: string, faceData?: string) => {
    // MOCK REGISTER
    if (!isSupabaseConfigured || !supabase) {
        const newUser = { 
            id: 'mock-user-' + Math.random().toString(36).substr(2, 9),
            email 
        };
        localStorage.setItem(MOCK_USER_KEY, JSON.stringify(newUser));
        if (faceData) {
            localStorage.setItem(`face_cache_${newUser.id}`, faceData);
        }
        return newUser;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) throw error;
    if (!data.user) throw new Error("Erro ao criar usuário.");

    if (faceData) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ user_id: data.user.id, face_data: faceData }]);
      if (profileError) console.error("Erro ao salvar biometria:", profileError);
    }
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

  getFaceData: async (userId: string): Promise<string | null> => {
    return localStorage.getItem(`face_cache_${userId}`);
  },

  cacheFaceData: async (userId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data } = await supabase
      .from('profiles')
      .select('face_data')
      .eq('id', userId)
      .single();
    if (data && data.face_data) {
      localStorage.setItem(`face_cache_${userId}`, data.face_data);
    }
  },

  sendVerificationCode: async (email: string): Promise<string> => {
    return new Promise((resolve) => setTimeout(() => resolve('123456'), 1000));
  }
};
