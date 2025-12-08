import supabase from './supabaseClient';
import { Transaction } from './types';

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

// Função com retry logic para salvar transação
export const saveTransaction = async (transaction: any, maxRetries = 3) => {
  console.log('🗑 [dbService] Tentando salvar transação:', transaction);
  
  // Validação
  const validation = validateTransaction(transaction);
  if (!validation.valid) {
    const errorMsg = `Validação falhou: ${validation.errors.join(', ')}`;
    console.error('❌ [dbService]', errorMsg);
    throw new Error(errorMsg);
  }
  
  // Verifica se Supabase está inicializado
  if (!supabase) {
    const err = 'Supabase não inicializado. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_KEY';
    console.error('🗑 [dbService]', err);
    throw new Error(err);
  }
  
  let lastError: any = null;
  
  // Loop de retentativas
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [dbService] Tentativa ${attempt}/${maxRetries}...`);
      
      const { data, error } = await supabase
        .from('transactions')
        .insert([transaction])
        .select();
      
      if (error) {
        lastError = error;
        console.error(`❌ [dbService] Erro na tentativa ${attempt}:`, error);
        
        // Se for erro de autenticação (401/403), não faz sentido tentar novamente
        if (error.status === 401 || error.status === 403) {
          throw new Error(`Erro de autenticação: ${error.message}`);
        }
        
        // Espera um pouco antes de tentar novamente
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } else {
        console.log('✅ [dbService] Transação salva com sucesso:', data);
        return data;
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ [dbService] Erro na tentativa ${attempt}:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Aguardando ${attempt}s antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  const finalError = lastError?.message || 'Erro desconhecido ao salvar transação';
  console.error('🗑 [dbService] FALHA FINAL após ' + maxRetries + ' tentativas:', finalError);
  throw new Error(finalError);
};

// Função para buscar transações do usuário
export const getTransactions = async (userId: string) => {
  console.log('🔍 [dbService] Buscando transações para user:', userId);
  
  if (!supabase) throw new Error('Supabase não inicializado');
  
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    console.log('✅ [dbService] Transações carregadas:', data?.length || 0);
    return data || [];
  } catch (error: any) {
    console.error('❌ [dbService] Erro ao buscar transações:', error.message);
    throw error;
  }
};

// Função para atualizar transação
export const updateTransaction = async (id: string, updates: any) => {
  console.log('🔎 [dbService] Atualizando transação:', id, updates);
  
  if (!supabase) throw new Error('Supabase não inicializado');
  
  try {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    console.log('✅ [dbService] Transação atualizada');
    return data;
  } catch (error: any) {
    console.error('❌ [dbService] Erro ao atualizar transação:', error.message);
    throw error;
  }
};

// Função para deletar transação
export const deleteTransaction = async (id: string) => {
  console.log('🗑 [dbService] Deletando transação:', id);
  
  if (!supabase) throw new Error('Supabase não inicializado');
  
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    console.log('✅ [dbService] Transação deletada');
  } catch (error: any) {
    console.error('❌ [dbService] Erro ao deletar transação:', error.message);
    throw error;
  }
};

// Função para adicionar múltiplas transações (import em massa)
export const addBulkTransactions = async (transactions: any[]) => {
  console.log('📖 [dbService] Importando ' + transactions.length + ' transações...');
  
  if (!supabase) throw new Error('Supabase não inicializado');
  
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactions)
      .select();
    
    if (error) throw error;
    console.log('✅ [dbService] Bulk import concluído:', data?.length || 0, 'transações');
    return data;
  } catch (error: any) {
    console.error('❌ [dbService] Erro ao fazer bulk import:', error.message);
    throw error;
  }
};

export const dbService = {
  saveTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  addBulkTransactions,
  validateTransaction
};

export default dbService;