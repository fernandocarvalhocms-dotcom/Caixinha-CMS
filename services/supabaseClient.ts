import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '';

// LOG de debug para verificar variáveis
console.log('[Supabase Init] VITE_SUPABASE_URL:', supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'UNDEFINED');
console.log('[Supabase Init] VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'UNDEFINED');

let supabase: any = null;
let isSupabaseConfigured = false;

try {
  if (supabaseUrl && supabaseAnonKey) {
    console.log('[Supabase] Inicializando cliente...');
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    isSupabaseConfigured = true;
    console.log('[Supabase] Cliente inicializado com sucesso!');
  } else {
    console.error('[Supabase ERROR] Variaveis ausentes:', {
      supabaseUrl: !!supabaseUrl,
      supabaseAnonKey: !!supabaseAnonKey,
      env: import.meta.env
    });
  }
} catch (error) {
  console.error('[Supabase ERROR] Erro ao inicializar Supabase:', error);
}

export default supabase;
export { isSupabaseConfigured };
