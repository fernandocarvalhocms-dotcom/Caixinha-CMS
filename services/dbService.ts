
import supabase, { isSupabaseConfigured } from './supabaseClient';
import { Transaction } from '../types';

// Função auxiliar para validar transação
const validateTransaction = (transaction: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!transaction.user_id) errors.push('user_id é obrigatório');
  if (!transaction.type) errors.push('type é obrigatório (receipt/fuel)');
  if (!transaction.date) errors.push('date é obrigatório');
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

const LOCAL_STORAGE_KEY = 'caixinha_transactions_demo';

export const addTransaction = async (transaction: any, userId: string) => {
  const transactionToSave = { ...transaction, user_id: userId };
  
  console.log('🗑 [dbService] Tentando salvar transação:', transactionToSave);
  
  const validation = validateTransaction(transactionToSave);
  if (!validation.valid) {
    const errorMsg = `Validação falhou: ${validation.errors.join(', ')}`;
    console.error('❌ [dbService]', errorMsg);
    throw new Error(errorMsg);
  }
  
  // --- MOCK MODE (LOCAL STORAGE) ---
if (!supabase) {      console.log('⚠️ Modo Demo: Salvando localmente no navegador');
throw new Error('❌ Supabase não configurado corretamente. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');  }
    }
  
  // --- REAL SUPABASE MODE ---
  const maxRetries = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [dbService] Tentativa ${attempt}/${maxRetries}...`);
      
      const { data, error } = await supabase
        .from('transactions')
        .insert([transactionToSave])
        .select();
      
      if (error) {
        lastError = error;
        if (error.status === 401 || error.status === 403) throw new Error(`Erro de autenticação: ${error.message}`);
        if (attempt < maxRetries) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        console.log('✅ [dbService] Transação salva com sucesso:', data);
        return data ? data[0] : null;
      }
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  const finalError = lastError?.message || 'Erro desconhecido ao salvar transação';
  throw new Error(finalError);
};

export const getTransactions = async (userId: string) => {
  console.log('🔍 [dbService] Buscando transações para user:', userId);
  
  // --- MOCK MODE ---
  if (!isSupabaseConfigured || !supabase) {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const items = stored ? JSON.parse(stored) : [];
      // Simula filtro por usuário
      return items.filter((t: any) => t.user_id === userId);
  }
  
  // --- REAL MODE ---
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('❌ [dbService] Erro ao buscar transações:', error.message);
    throw error;
  }
};

export const updateTransaction = async (id: string, updates: any, userId: string) => {
  // --- MOCK MODE ---
  if (!isSupabaseConfigured || !supabase) {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      let items = stored ? JSON.parse(stored) : [];
      items = items.map((t: any) => (t.id === id ? { ...t, ...updates } : t));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
      return { ...updates, id };
  }
  
  // --- REAL MODE ---
  try {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select();
    
    if (error) throw error;
    return data ? data[0] : null;
  } catch (error: any) {
    console.error('❌ [dbService] Erro ao atualizar transação:', error.message);
    throw error;
  }
};

export const deleteTransaction = async (id: string) => {
  // --- MOCK MODE ---
  if (!isSupabaseConfigured || !supabase) {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      let items = stored ? JSON.parse(stored) : [];
      items = items.filter((t: any) => t.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
      return;
  }
  
  // --- REAL MODE ---
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  } catch (error: any) {
    console.error('❌ [dbService] Erro ao deletar transação:', error.message);
    throw error;
  }
};

export const addBulkTransactions = async (transactions: any[], userId: string) => {
  const transactionsToSave = transactions.map(t => ({ ...t, user_id: userId }));
  
  // --- MOCK MODE ---
  if (!isSupabaseConfigured || !supabase) {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const items = stored ? JSON.parse(stored) : [];
      const newItems = [...transactionsToSave, ...items];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems));
      return transactionsToSave;
  }
  
  // --- REAL MODE ---
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactionsToSave)
      .select();
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ [dbService] Erro ao fazer bulk import:', error.message);
    throw error;
  }
};

export const dbService = {
  addTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  addBulkTransactions,
  validateTransaction
};

export default dbService;
