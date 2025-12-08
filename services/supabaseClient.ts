import { createClient } from '@supabase/supabase-js';

// Função segura para ler variáveis de ambiente
// NÃO use try/catch aqui - isso impede que ferramentas de build detectem a variável
const getSupabaseConfig = () => {
  // Tentativa 1: import.meta.env (Vite)
  const urlVite = import.meta.env.VITE_SUPABASE_URL;
  const keyVite = import.meta.env.VITE_SUPABASE_KEY;
  
  if (urlVite && keyVite) {
    console.log('✅ Supabase carregado de import.meta.env (Vite)');
    return { url: urlVite, key: keyVite };
  }
  
  // Tentativa 2: process.env (Node/Build-time)
  const urlProcess = process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const keyProcess = process.env.VITE_SUPABASE_KEY || process.env.REACT_APP_SUPABASE_KEY;
  
  if (urlProcess && keyProcess) {
    console.log('✅ Supabase carregado de process.env');
    return { url: urlProcess, key: keyProcess };
  }
  
  // Fallback: placeholder (permite que a UI carregue)
  console.warn('⚠️ Variáveis Supabase não encontradas. Configure VITE_SUPABASE_URL e VITE_SUPABASE_KEY');
  return {
    url: 'https://placeholder.supabase.co',
    key: 'placeholder-key'
  };
};

const config = getSupabaseConfig();

// Inicializa o cliente Supabase
let supabase: any = null;

try {
  supabase = createClient(config.url, config.key);
  console.log('🔓 Cliente Supabase inicializado');
} catch (error) {
  console.error('❌ Erro ao inicializar Supabase:', error);
  supabase = null;
}

export default supabase;
export { config, getSupabaseConfig };