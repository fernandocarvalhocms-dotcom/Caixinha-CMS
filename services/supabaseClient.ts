import { createClient } from '@supabase/supabase-js';

const getSupabaseClient = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Variáveis de ambiente não configuradas. Usando valores padrão.');
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

const supabase = getSupabaseClient();

export default supabase;
