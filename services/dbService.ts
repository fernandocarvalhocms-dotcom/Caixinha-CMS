
import { supabase } from './supabaseClient';
import { Transaction, Expense, FuelEntry } from '../types';

// Helper para converter do formato do App (camelCase) para o Banco (snake_case)
const mapToDb = (t: Transaction, userId: string) => {
  if (t.type === 'receipt') {
    const expense = t as Expense;
    return {
      user_id: userId,
      type: 'receipt',
      date: expense.date,
      amount: expense.amount,
      category: expense.category,
      city: expense.city,
      operation: expense.operation,
      notes: expense.notes,
      receipt_image: expense.receiptImage || null, // Banco aceita null
      // Campos de combustível nulos
      origin: null,
      destination: null,
      car_type: null,
      road_type: null,
      distance_km: null,
      fuel_type: null,
      price_per_liter: null,
      consumption: null,
      total_value: null
    };
  } else {
    const fuel = t as FuelEntry;
    return {
      user_id: userId,
      type: 'fuel',
      date: fuel.date,
      origin: fuel.origin,
      destination: fuel.destination,
      car_type: fuel.carType,
      road_type: fuel.roadType,
      distance_km: fuel.distanceKm,
      operation: fuel.operation,
      fuel_type: fuel.fuelType,
      price_per_liter: fuel.pricePerLiter,
      consumption: fuel.consumption,
      total_value: fuel.totalValue,
      // Campos de despesa nulos
      amount: null,
      category: null,
      city: null,
      notes: null,
      receipt_image: null
    };
  }
};

// Helper para converter do Banco (snake_case) para o App (camelCase)
const mapFromDb = (row: any): Transaction => {
  if (row.type === 'receipt') {
    return {
      id: row.id,
      type: 'receipt',
      date: row.date,
      amount: parseFloat(row.amount),
      category: row.category,
      city: row.city,
      operation: row.operation,
      notes: row.notes || '',
      receiptImage: row.receipt_image || undefined
    } as Expense;
  } else {
    return {
      id: row.id,
      type: 'fuel',
      date: row.date,
      origin: row.origin,
      destination: row.destination,
      carType: row.car_type,
      roadType: row.road_type,
      distanceKm: parseFloat(row.distance_km),
      operation: row.operation,
      fuelType: row.fuel_type,
      pricePerLiter: parseFloat(row.price_per_liter),
      consumption: parseFloat(row.consumption),
      totalValue: parseFloat(row.total_value)
    } as FuelEntry;
  }
};

export const dbService = {
  // Adicionar Transação Única
  addTransaction: async (transaction: Transaction, userId: string): Promise<Transaction> => {
    const dbPayload = mapToDb(transaction, userId);
    
    // Remove o ID gerado no front para deixar o banco gerar (ou usa se for UUID válido)
    // Supabase retorna o objeto criado
    const { data, error } = await supabase
      .from('transactions')
      .insert([dbPayload])
      .select()
      .single();

    if (error) {
      console.error('Supabase Add Error:', error);
      throw new Error(`Erro ao salvar: ${error.message}`);
    }
    
    return mapFromDb(data);
  },

  // Adicionar Várias (Importação em Massa)
  addBulkTransactions: async (transactions: Transaction[], userId: string): Promise<Transaction[]> => {
    const dbPayloads = transactions.map(t => mapToDb(t, userId));
    
    const { data, error } = await supabase
      .from('transactions')
      .insert(dbPayloads)
      .select();

    if (error) {
      console.error('Supabase Bulk Add Error:', error);
      throw new Error(`Erro ao importar dados: ${error.message}`);
    }

    return (data || []).map(mapFromDb);
  },

  // Buscar todas do usuário
  getTransactions: async (userId: string): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Supabase Get Error:', error);
      throw new Error(`Erro ao carregar dados: ${error.message}`);
    }

    return (data || []).map(mapFromDb);
  },

  // Atualizar
  updateTransaction: async (id: string, transaction: Transaction, userId: string): Promise<void> => {
    const dbPayload = mapToDb(transaction, userId);
    
    const { error } = await supabase
      .from('transactions')
      .update(dbPayload)
      .eq('id', id)
      .eq('user_id', userId); // Garante que só edita o próprio dado

    if (error) {
      console.error('Supabase Update Error:', error);
      throw new Error(`Erro ao atualizar: ${error.message}`);
    }
  },

  // Deletar
  deleteTransaction: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase Delete Error:', error);
      throw new Error(`Erro ao excluir: ${error.message}`);
    }
  }
};
