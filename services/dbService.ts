
import { getSupabase } from './supabaseClient';

// --- MAPPERS (Adapters) ---
// Converte do formato do Frontend (camelCase) para o Banco (snake_case)
const toDatabaseFormat = (t: any, userId: string) => {
    return {
        id: (t.id && t.id.length > 20) ? t.id : undefined, // Deixa o Postgres gerar se for inválido
        user_id: userId,
        date: t.date,
        // Para despesas, usa 'city'. Para combustível, combina origem/destino se city for nulo
        city: t.city || (t.origin ? `${t.origin} -> ${t.destination}` : null),
        
        amount: t.type === 'receipt' ? t.amount : (t.receiptAmount || 0), 
        
        category: t.category, 
        operation: t.operation,
        notes: t.notes,
        type: t.type,
        
        receipt_image: t.receiptImage,

        // Campos Específicos de Combustível
        origin: t.origin,
        destination: t.destination,
        car_type: t.carType,
        road_type: t.roadType,
        distance_km: t.distanceKm,
        fuel_type: t.fuelType,
        price_per_liter: t.pricePerLiter,
        consumption: t.consumption,
        total_value: t.totalValue
    };
};

// Converte do Banco (snake_case) para o Frontend (camelCase)
const fromDatabaseFormat = (row: any): any => {
    const base = {
        id: row.id,
        user_id: row.user_id,
        date: row.date,
        operation: row.operation,
        notes: row.notes,
        type: row.type || 'receipt',
        receiptImage: row.receipt_image, 
    };

    if (row.type === 'fuel') {
        return {
            ...base,
            origin: row.origin,
            destination: row.destination,
            carType: row.car_type,
            roadType: row.road_type,
            distanceKm: Number(row.distance_km || 0),
            fuelType: row.fuel_type,
            price_per_liter: Number(row.price_per_liter || 0),
            pricePerLiter: Number(row.price_per_liter || 0),
            consumption: Number(row.consumption || 0),
            totalValue: Number(row.total_value || 0),
            receiptAmount: Number(row.amount || 0), 
            amount: 0, 
            city: row.city || '',
            category: 'Combustível'
        };
    } else {
        return {
            ...base,
            city: row.city,
            amount: Number(row.amount || 0),
            category: row.category,
        };
    }
};

const LOCAL_STORAGE_KEY = 'caixinha_transactions_demo';

export const addTransaction = async (transaction: any, userId: string) => {
  const dbFormat = toDatabaseFormat(transaction, userId);
  const client = getSupabase();
  
  // --- MOCK / OFFLINE MODE ---
  if (!client) {
      console.log('⚠️ Modo Offline: Salvando localmente');
      await new Promise(r => setTimeout(r, 500));
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const items = stored ? JSON.parse(stored) : [];
      items.unshift({ ...transaction, id: transaction.id || Math.random().toString() });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
      return transaction;
  }
  
  // --- REAL SUPABASE MODE ---
  try {
      const { data, error } = await client
        .from('transactions')
        .insert([dbFormat])
        .select();
      
      if (error) {
        console.error('❌ Erro Supabase Insert:', JSON.stringify(error, null, 2));
        if (error.code === '42P01' || error.code === 'PGRST204' || error.message?.includes('does not exist') || error.message?.includes('column')) {
             throw new Error("TABLE_NOT_FOUND");
        }
        throw new Error(`Erro DB: ${error.message} (${error.code})`);
      }
      
      return fromDatabaseFormat(data[0]);

  } catch (error: any) {
      if (error.message === 'TABLE_NOT_FOUND') throw error;
      throw error;
  }
};

export const getTransactions = async (userId: string) => {
  const client = getSupabase();
  
  if (!client) {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
  }
  
  try {
    const { data, error } = await client
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    
    if (error) {
        console.error('❌ Erro ao buscar transações:', JSON.stringify(error, null, 2));
        if (error.code === '42P01') throw new Error("TABLE_NOT_FOUND");
        throw error;
    }
    
    return (data || []).map(fromDatabaseFormat);

  } catch (error: any) {
    if (error.message === 'TABLE_NOT_FOUND') {
        throw error;
    }
    throw error;
  }
};

export const updateTransaction = async (id: string, updates: any, userId: string) => {
  const client = getSupabase();
  if (!client) return { ...updates, id };

  const dbUpdates = toDatabaseFormat({ ...updates, id }, userId);
  Object.keys(dbUpdates).forEach(key => (dbUpdates as any)[key] === undefined && delete (dbUpdates as any)[key]);

  try {
    const { data, error } = await client
      .from('transactions')
      .update(dbUpdates)
      .eq('id', id)
      .select();
    
    if (error) {
        console.error('Erro update:', JSON.stringify(error, null, 2));
        if (error.code === 'PGRST204') throw new Error("TABLE_NOT_FOUND");
        throw error;
    }
    return fromDatabaseFormat(data[0]);
  } catch (error) {
    throw error;
  }
};

export const deleteTransaction = async (id: string) => {
  const client = getSupabase();
  if (!client) return;
  
  const { error } = await client.from('transactions').delete().eq('id', id);
  if (error) {
      console.error('Erro delete:', JSON.stringify(error, null, 2));
      throw error;
  }
};

export const deleteAllTransactions = async (userId: string) => {
    const client = getSupabase();
    
    // Modo Offline
    if (!client) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        return { count: 'all local' };
    }

    console.log(`🗑️ Iniciando exclusão total para user_id: ${userId}`);

    // GARANTE QUE TEM SESSÃO ATIVA
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
        throw new Error("Sessão perdida. Faça login novamente para deletar.");
    }

    // EXCLUSÃO
    const { error, count } = await client
        .from('transactions')
        .delete({ count: 'exact' })
        .eq('user_id', userId);

    if (error) {
        console.error('Erro Fatal ao deletar tudo:', JSON.stringify(error, null, 2));
        throw error;
    }
    
    return { success: true, count };
};

export const addBulkTransactions = async (transactions: any[], userId: string) => {
    const client = getSupabase();
    if (!client) return transactions;

    const dbData = transactions.map(t => toDatabaseFormat(t, userId));

    try {
        const { data, error } = await client.from('transactions').insert(dbData).select();
        if (error) {
             if (error.code === '42P01' || error.code === 'PGRST204') throw new Error("TABLE_NOT_FOUND");
             throw error;
        }
        return data.map(fromDatabaseFormat);
    } catch (error: any) {
        console.error("Bulk Insert Error:", JSON.stringify(error, null, 2));
        throw error;
    }
}

export const dbService = {
  addTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  deleteAllTransactions,
  addBulkTransactions
};

export default dbService;
