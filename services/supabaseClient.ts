import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '';

let supabase: any = null;

try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } else {
    console.error('Supabase env vars missing:', { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey });
  }
} catch (error) {
  console.error('Erro ao inicializar Supabase:', error);
}

export default supabase;
