import { createClient } from '@supabase/supabase-js';

// Carregar variáveis de ambiente (Vite)
const url = process.env.ITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_KEY || '';

// Log para debug
console.log('🔍 Verificando configuração Supabase:', {
  url: url ? 'Definida' : 'FALTANDO',
  key: key ? 'Definida' : 'FALTANDO'
});

// Inicializar cliente Supabase com valores vazios se não configurados
// Isso permite que a app carregue e mostre erro mais claro
const supabase = url && key ? createClient(url, key) : null;

if (!url || !key) {
  console.error('❌ ERRO: Variáveis Supabase não encontradas!');
  console.error('   Defina VITE_SUPABASE_URL e VITE_SUPABASE_KEY no .env.local ou Vercel');
}

export default supabase;
