import supabase from './supabaseClient';

export const authService = {
  getCurrentUser: async () => {
    if (!supabase) {
      console.error('[authService] Supabase não inicializado!');
      throw new Error('Supabase não está configurado');
    }
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  register: async (email: string, password: string) => {
    if (!supabase) {
      console.error('[authService] Supabase não inicializado!');
      throw new Error('Supabase não está configurado');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Erro ao criar usuário.');
    return data.user;
  },

  login: async (email: string, password: string) => {
    if (!supabase) {
      console.error('[authService] Supabase não inicializado!');
      throw new Error('Supabase não está configurado');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.user;
  },

  logout: async () => {
    if (!supabase) {
      console.error('[authService] Supabase não inicializado!');
      throw new Error('Supabase não está configurado');
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  
  sendVerificationCode: async (email: string) => {
    // Simulado: Em produção, usar Supabase Auth OTP via email
    console.log('[authService] Enviando código de verificação para:', email);
    // Supabase tem magicLink ou OTP, mas por enquanto simulamos
    return Promise.resolve();
  },

  cacheFaceData: async (userId: string) => {
    // Armazenar dados biométricos no localStorage (apenas para demo)
    // Em produção, seria no Supabase com RLS
    console.log('[authService] Cache de biometria para:', userId);
    return Promise.resolve();
  },
};
