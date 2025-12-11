
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Chaves de armazenamento local para configuração dinâmica
export const STORAGE_KEY_URL = 'caixinha_supabase_url';
export const STORAGE_KEY_KEY = 'caixinha_supabase_key';

// CREDENCIAIS FORNECIDAS PELO USUÁRIO
const PROVIDED_URL = 'https://buvcicexndjxnbpipatf.supabase.co';
const PROVIDED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dmNpY2V4bmRqeG5icGlwYXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDc1NjQsImV4cCI6MjA4MDg4MzU2NH0.ehZJUhvFACM-turRL-QC9786uYLQiQn9A6nSs-CsZPU';

// Instância Singleton
let supabaseInstance: SupabaseClient | null = null;

const getSupabaseConfig = () => {
  let url = localStorage.getItem(STORAGE_KEY_URL);
  let key = localStorage.getItem(STORAGE_KEY_KEY);

  if (!url || !key) {
      url = PROVIDED_URL;
      key = PROVIDED_KEY;
  }

  if ((!url || !key) && typeof import.meta !== 'undefined') {
    // @ts-ignore
    if (import.meta.env.VITE_SUPABASE_URL) url = import.meta.env.VITE_SUPABASE_URL;
    // @ts-ignore
    if (import.meta.env.VITE_SUPABASE_KEY) key = import.meta.env.VITE_SUPABASE_KEY;
  }

  if (url && key && url.startsWith('http')) {
      return { url, key };
  }
  
  return null;
};

export const initSupabase = () => {
    const conf = getSupabaseConfig();
    if (conf) {
        try {
            // Só cria se ainda não existir
            if (!supabaseInstance) {
                supabaseInstance = createClient(conf.url, conf.key, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                });
                console.log('🔓 Supabase (Singleton) inicializado');
            }
            return supabaseInstance;
        } catch (error) {
            console.error('Erro ao init Supabase:', error);
            return null;
        }
    }
    return null;
};

// Getter seguro que tenta inicializar se necessário
export const getSupabase = () => {
    if (!supabaseInstance) {
        return initSupabase();
    }
    return supabaseInstance;
};

export const isSupabaseConfigured = () => !!getSupabaseConfig();

// Inicializa imediatamente ao carregar
initSupabase();

export default getSupabase;
