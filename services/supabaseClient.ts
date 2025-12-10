
import { createClient } from '@supabase/supabase-js';

// Chaves de armazenamento local para configuração dinâmica
export const STORAGE_KEY_URL = 'caixinha_supabase_url';
export const STORAGE_KEY_KEY = 'caixinha_supabase_key';

// CREDENCIAIS FORNECIDAS PELO USUÁRIO
const PROVIDED_URL = 'https://buvcicexndjxnbpipatf.supabase.co';
const PROVIDED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dmNpY2V4bmRqeG5icGlwYXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDc1NjQsImV4cCI6MjA4MDg4MzU2NH0.ehZJUhvFACM-turRL-QC9786uYLQiQn9A6nSs-CsZPU';

const getSupabaseConfig = () => {
  // 1. Prioridade: LocalStorage (caso o usuário mude na interface)
  let url = localStorage.getItem(STORAGE_KEY_URL);
  let key = localStorage.getItem(STORAGE_KEY_KEY);

  // 2. Se não tiver no storage, usa as credenciais fornecidas hardcoded
  if (!url || !key) {
      url = PROVIDED_URL;
      key = PROVIDED_KEY;
  }

  // 3. Fallback para variáveis de ambiente (Vite/Node)
  if ((!url || !key) && typeof import.meta !== 'undefined') {
    // @ts-ignore
    if (import.meta.env.VITE_SUPABASE_URL) url = import.meta.env.VITE_SUPABASE_URL;
    // @ts-ignore
    if (import.meta.env.VITE_SUPABASE_KEY) key = import.meta.env.VITE_SUPABASE_KEY;
  }

  // Validação básica
  if (url && key && url.startsWith('http')) {
      return { url, key };
  }
  
  return null;
};

const config = getSupabaseConfig();
const isSupabaseConfigured = !!config;

let supabase: any = null;

export const initSupabase = () => {
    const conf = getSupabaseConfig();
    if (conf) {
        try {
            supabase = createClient(conf.url, conf.key);
            console.log('🔓 Supabase inicializado com:', conf.url);
            return supabase;
        } catch (error) {
            console.error('Erro ao init Supabase:', error);
            return null;
        }
    }
    return null;
};

// Inicialização imediata
if (isSupabaseConfigured && config) {
  try {
    supabase = createClient(config.url, config.key);
  } catch (error) {
    console.error('❌ Erro ao inicializar Supabase:', error);
    supabase = null;
  }
}

export default supabase;
export { isSupabaseConfigured };
