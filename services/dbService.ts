import supabase, { isSupabaseConfigured } from './supabaseClient';
import { Transaction } from '../types';

// Função auxiliar para validar transação
const validateTransaction = (transaction: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!transaction.user_id) errors.push('user_id é obrigatório');
  if (transaction.amount === undefined || transaction.amount === null) {
    errors.push('amount é obrigatório');
  } else if (isNaN(Number(transaction.amount))) {
    errors.push('amount deve ser um número válido');
  }
  if (!transaction.date) errors.push('date é obrigatório');
  return {
    valid: errors.length === 0,
    errors
  };
};

// ===== SUPABASE REAL MODE (ONLY) =====
export const addTransaction = async (transaction: any, userId: string) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('❌ Supabase não está configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  // Preparar transação com apenas os campos que existem na tabela
  const transactionToSave = {
    user_id: userId,
    amount: transaction.amount || 0,
    date: transaction.date || new Date().toISOString().split('T')[0],
    type: transaction.type || 'receipt',
    city: transaction.city || null,
    category: transaction.category || null,
    notes: transaction.notes || null,
    image_url: transaction.image_url || null,
    operation_id: transaction.operation_id || null,
  };

  const validation = validateTransaction(transactionToSave);
  if (!validation.valid) {
    throw new Error(`Validação falhou: ${validation.errors.join(', ')}`);
  }

  console.log('✅ [dbService] Salvando transação no Supabase para usuário:', userId);
  console.log('[dbService] transactionToSave:', transactionToSave);

  const { data, error } = await supabase
    .from('transactions')
    .insert([transactionToSave])
    .select();

  console.log('[dbService] DEBUG - Insert response:', { data, error });

  if (error) {
    console.error('❌ [dbService] Erro ao salvar no Supabase:', error);
    throw new Error(`Erro ao salvar: ${error.message}`);
  }

  console.log('✅ [dbService] Transação salva com sucesso:', data?.[0]);
  return data?.[0];
};

export const getTransactions = async (userId: string) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('❌ Supabase não está configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  console.log('🔍 [dbService] Buscando transações do usuário:', userId);
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('❌ [dbService] Erro ao buscar:', error);
    throw new Error(`Erro ao buscar: ${error.message}`);
  }

  console.log('✅ [dbService] Encontradas', data?.length || 0, 'transações');
  return data || [];
};

export const updateTransaction = async (transactionId: string, updates: any, userId: string) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('❌ Supabase não está configurado.');
  }

  console.log('✏️ [dbService] Atualizando transação:', transactionId);
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', transactionId)
    .eq('user_id', userId)
    .select();

  if (error) {
    console.error('❌ [dbService] Erro ao atualizar:', error);
    throw new Error(`Erro ao atualizar: ${error.message}`);
  }

  console.log('✅ [dbService] Transação atualizada com sucesso');
  return data?.[0];
};

export const deleteTransaction = async (transactionId: string, userId: string) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('❌ Supabase não está configurado.');
  }

  console.log('🗑️ [dbService] Deletando transação:', transactionId);
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', userId);

  if (error) {
    console.error('❌ [dbService] Erro ao deletar:', error);
    throw new Error(`Erro ao deletar: ${error.message}`);
  }

  console.log('✅ [dbService] Transação deletada com sucesso');
};

export const bulkSaveTransactions = async (transactions: any[], userId: string) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('❌ Supabase não está configurado.');
  }

  if (!transactions || transactions.length === 0) return [];

  const transactionsWithUserId = transactions.map(t => ({
    user_id: userId,
    amount: t.amount || 0,
    date: t.date || new Date().toISOString().split('T')[0],
    type: t.type || 'receipt',
    city: t.city || null,
    category: t.category || null,
    notes: t.notes || null,
    image_url: t.image_url || null,
    operation_id: t.operation_id || null,
  }));

  console.log('📋 [dbService] Salvando', transactionsWithUserId.length, 'transações em lote');
  const { data, error } = await supabase
    .from('transactions')
    .upsert(transactionsWithUserId, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('❌ [dbService] Erro no bulk insert:', error);
    throw new Error(`Erro ao salvar lote: ${error.message}`);
  }

  console.log('✅ [dbService] Lote salvo com sucesso');
  return data || [];
};

export default { addTransaction, getTransactions, updateTransaction, deleteTransaction, bulkSaveTransactions };
