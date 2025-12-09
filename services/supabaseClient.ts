import { createClient } from '@supabase/supabase-js';

// Carregar variáveis de ambiente (Vite)
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

if (!url || !key) {
  console.error('❌ ERRO CRÍTICO: Variáveis de ambiente Supabase não configuradas!');
  console.error('   Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_KEY estão definidas no .env.local ou Vercel');
  throw new Error('Supabase configuration missing');
}

console.log('✅ Supabase configurado:', { url, key: key.substring(0, 20) + '...' });

// Inicializar cliente Supabase
const supabase = createClient(url, key);

export default supabase;
