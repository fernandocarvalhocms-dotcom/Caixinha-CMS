
import supabase from './supabaseClient';
export const authService = {
  // Verificar se usuário existe (O Supabase lida com isso no registro, 
  // mas podemos checar sessão atual)
  getCurrentUser: async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  // Registro real no Supabase
  register: async (email: string, password: string, faceData?: string) => {
    // 1. Criar Auth User
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
          options: {
                  emailRedirectTo: `${window.location.origin}/auth/callback`,
                      },
                      
    });

    if (error) throw error;
    if (!data.user) throw new Error("Erro ao criar usuário.");

       // 1.5. Fazer login imediatamente para estabelecer sessão
       await supabase.auth.signInWithPassword({ email, password });
    await new Promise(resolve => setTimeout(resolve, 2000));
    // 2. Se tiver biometria, salvar na tabela 'profiles'
if (faceData) {
    try {
      // Pegar user_id ANTES de usar
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        console.error("Erro: user_id não disponível após login");
        return data.user;
      }
      
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          { user_id: user.id, face_data: faceData }
        ]);
      
      if (profileError) {
console.error("Erro ao salvar biometria:", profileError);
            throw new Error(`Erro ao salvar biometria: ${profileError?.message || 'Desconhecido'}`);}    
    } catch (error) {
throw error;    }
}
    return data.user;
  },

  // Login real
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data.user;
  },

  // Logout
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Buscar dados biométricos do banco
  getFaceData: async (userId: string): Promise<string | null> => {
    // Supabase RLS: Usuário só lê o próprio perfil.
    // Se o usuário ainda não logou, não conseguimos ler (por segurança).
    // A lógica de login facial precisa ser:
    // 1. Usuário digita email
    // 2. App tenta buscar perfil público? (Risco de segurança expor foto)
    // 
    // CORREÇÃO DE FLUXO:
    // Para login biométrico seguro sem expor dados, normalmente se faz login no servidor.
    // Como estamos client-side, vamos assumir que o usuário precisa logar com senha primeiro
    // OU usar a tabela profiles com uma política que permita leitura pública (não recomendado)
    // OU armazenar biometria localmente como "cache" para conveniência.
    //
    // Para este MVP, vamos buscar do perfil APÓS login ou usar uma função RPC se disponível.
    // Se o usuário não está logado, supabase.auth.getUser() é null.
    // 
    // Solução alternativa para o desafio: 
    // O login biométrico via Frontend + Supabase puro é complexo pois requer ler dados 
    // privados sem estar autenticado.
    // Vamos manter a lógica: O login facial só funciona se tivermos cache local ou 
    // se o usuário já tiver uma sessão válida (re-autenticação).
    //
    // Para simplificar e atender o pedido: Vamos tentar buscar pelo email (inseguro se RLS estiver ativo).
    // Assumindo que o Admin configurou RLS para permitir leitura pelo ID.
    
    // O ideal: Usuário digita email -> Edge Function retorna hash da face -> Compara.
    // Simulação aqui: Vamos tentar ler a tabela profiles.
    
    // NOTA: Isso falhará se o usuário não estiver logado e o RLS estiver ativo.
    // Para o MVP funcionar, o usuário precisa ter logado pelo menos uma vez nesse dispositivo
    // e guardaremos o faceData no localStorage como cache seguro.
    
    return localStorage.getItem(`face_cache_${userId}`);
  },

  // Cachear face data após login com sucesso
  cacheFaceData: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('face_data')
      .eq('user_id', userId)
      .single();
    
    if (data && data.face_data) {
      localStorage.setItem(`face_cache_${userId}`, data.face_data);
    }
  },

  sendVerificationCode: async (email: string): Promise<string> => {
    // Supabase envia email real se configurado.
    // Aqui simulamos apenas para manter a UI
    return new Promise((resolve) => setTimeout(() => resolve('123456'), 1000));
  }
};
