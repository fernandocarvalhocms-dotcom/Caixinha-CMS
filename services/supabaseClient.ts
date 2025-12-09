import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente Supabase não configuradas: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
