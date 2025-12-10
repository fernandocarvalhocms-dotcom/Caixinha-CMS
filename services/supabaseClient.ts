
import { createClient } from '@supabase/supabase-js';

// Configurações fornecidas pelo usuário
const DEFAULT_PROJECT_URL = 'https://buvcicexndjxnbpipatf.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dmNpY2V4bmRqeG5icGlwYXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDc1NjQsImV4cCI6MjA4MDg4MzU2NH0.ehZJUhvFACM-turRL-QC9786uYLQiQn9A6nSs-CsZPU';

// Função segura para ler variáveis de ambiente ou usar as chaves padrão fornecidas
const getSupabaseConfig = () => {
  let url = DEFAULT_PROJECT_URL;
  let key = DEFAULT_ANON_KEY;

  // 1. Tenta ler import.meta.env (Vite) para sobrescrever se necessário
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env.VITE_SUPABASE_URL) url = import.meta.env.VITE_SUPABASE_URL;
      // @ts-ignore
      if (import.meta.env.VITE_SUPABASE_KEY) key = import.meta.env.VITE_SUPABASE_KEY;
    }
  } catch (e) {}

  // 2. Tenta ler process.env (Node/Webpack) para sobrescrever se necessário
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_SUPABASE_URL) url = process.env.VITE_SUPABASE_URL;
    else if (process.env.REACT_APP_SUPABASE_URL) url = process.env.REACT_APP_SUPABASE_URL;

    if (process.env.VITE_SUPABASE_KEY) key = process.env.VITE_SUPABASE_KEY;
    else if (process.env.REACT_APP_SUPABASE_KEY) key = process.env.REACT_APP_SUPABASE_KEY;
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
    console.log('🔓 Cliente Supabase inicializado com:', config.url);
  } catch (error) {
    console.error('❌ Erro ao inicializar Supabase:', error);
    supabase = null;
  }
} else {
    console.warn('⚠️ Supabase não configurado ou chaves ausentes. App rodará em modo DEMO (LocalStorage).');
}

export default supabase;
export { isSupabaseConfigured };
