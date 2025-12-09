import { createClient } from '@supabase/supabase-js';

// Função segura para ler variáveis de ambiente
const getSupabaseConfig = () => {
  let urlVite, keyVite;

  // 1. Try import.meta.env (Vite)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      urlVite = import.meta.env.VITE_SUPABASE_URL;
      // @ts-ignore
      keyVite = import.meta.env.VITE_SUPABASE_ANON_KEY;
    }
  } catch (e) {}

  // 2. Try process.env (Fallback)
  let url = urlVite;
  let key = keyVite;

  if (!url || !key) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
        key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_KEY;
      }
    } catch(e) {}
  }

  // Verifica se é uma URL válida (não vazia e começa com http)
  if (url && key && url.startsWith('http') && !url.includes('placeholder')) {
      return { url, key };
  }
  
  return null;
};

const config = getSupabaseConfig();
const isSupabaseConfigured = !!config;

let supabase: any = null;

if (isSupabaseConfigured && config) {
  try {
    supabase = createClient(config.url, config.key);
    console.log('🔓 Cliente Supabase inicializado');
  } catch (error) {
    console.error('❌ Erro ao inicializar Supabase:', error);
    supabase = null;
  }
} else {
    console.warn('⚠️ Supabase não configurado ou chaves ausentes. App rodará em modo DEMO (LocalStorage).');
}

export default supabase;
export { isSupabaseConfigured };
