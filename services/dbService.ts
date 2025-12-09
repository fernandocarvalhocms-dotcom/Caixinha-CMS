import supabase, { isSupabaseConfigured } from './supabaseClient';
import { Transaction } from '../types';

// Função auxiliar para validar transação
const validateTransaction = (transaction: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!transaction.user_id) errors.push('user_id é obrigatório');
  if (!transaction.type) errors.push('type é obrigatório (receipt/fuel)');
  if (transaction.amount === undefined || transaction.amount === null) {
    errors.push('amount é obrigatório');
  } else if (isNaN(Number(transaction.amount))) {
    errors.push('amount deve ser um número válido');
  }

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

  const transactionToSave = { ...transaction, user_id: userId };

  const validation = validateTransaction(transactionToSave);
  if (!validation.valid) {
    throw new Error(`Validação falhou: ${validation.errors.join(', ')}`);
  }

  console.log('✅ [dbService] Salvando transação no Supabase para usuário:', userId);

  const { data, error } = await supabase
    .from('transactions')
    .insert([transactionToSave])
    .select();

  if (error) {
    console.error('❌ [dbService] Erro ao salvar no Supabase:', error);
    throw new Error(`Erro ao salvar: ${error.message}`);
  }

  console.log('✅ [dbService] Transação salva com sucesso');
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
    .eq('user_id', userId)  // FILTRO CRITICO: Apenas transações deste usuário
    .order('created_at', { ascending: false });

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
    .eq('user_id', userId)  // FILTRO CRITICO: Validar propriedade do usuário
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
    .eq('user_id', userId);  // FILTRO CRITICO: Validar propriedade do usuário

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

  const transactionsWithUserId = transactions.map(t => ({ ...t, user_id: userId }));

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
