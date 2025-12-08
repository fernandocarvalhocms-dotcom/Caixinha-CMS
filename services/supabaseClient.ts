import { createClient } from '@supabase/supabase-js';

// Pega as credenciais do Supabase das variáveis de ambiente
const getSupabaseCredentials = () => {
  // Tenta diferentes formas de obter as variáveis de ambiente
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_KEY || '';
  
  return { url, key };
};

// Inicializa o cliente Supabase com fallback seguro
let supabase: any = null;

const getSupabaseClient = () => {
  if (!supabase) {
    const { url, key } = getSupabaseCredentials();
    
    if (!url || !key) {
      console.error('Supabase credentials not found. Configure VITE_SUPABASE_URL and VITE_SUPABASE_KEY');
      return null;
    }
    
    try {
      supabase = createClient(url, key);
    } catch (error) {
      console.error('Erro ao inicializar Supabase:', error);
      return null;
    }
  }
  
  return supabase;
};

export const supabase = getSupabaseClient();