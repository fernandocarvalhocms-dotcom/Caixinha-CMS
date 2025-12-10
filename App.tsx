
import React, { useState, useEffect, useCallback } from 'react';
import Login from './components/Login';
import ReceiptScanner from './components/ReceiptScanner';
import FuelCalculator from './components/FuelCalculator';
import ReportSettings from './components/ReportSettings';
import StatementView from './components/StatementView';
import TollParkingImport from './components/TollParkingImport';
import Instructions from './components/Instructions';
import { Transaction, AppState, Expense, FuelEntry } from './types';
import * as XLSX from 'xlsx';
import { authService } from './services/authService';
import { dbService } from './services/dbService';
import { STORAGE_KEY_URL, STORAGE_KEY_KEY, initSupabase } from './services/supabaseClient';

const SHEET_ID = '1SjHoaTjNMDPsdtOSLJB1Hte38G8w2yZCftz__Nc4d-s';

// SQL OTIMIZADO: CRIA TABELA SE NÃO EXISTIR E ADICIONA COLUNAS SE A TABELA JÁ EXISTIR (MIGRAÇÃO)
const SETUP_SQL = `
-- 1. Cria a tabela básica se não existir
create table if not exists public.transactions (
  id uuid not null primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid not null default auth.uid(),
  date date,
  city text,
  amount numeric,
  category text,
  operation text,
  notes text,
  type text
);

-- 2. Garante que RLS (Segurança) está ativado
alter table public.transactions enable row level security;

-- 3. Adiciona colunas que podem estar faltando (Migração Segura)
-- Isso corrige o erro "Could not find column" se a tabela antiga existir
alter table public.transactions add column if not exists receipt_image text;
alter table public.transactions add column if not exists origin text;
alter table public.transactions add column if not exists destination text;
alter table public.transactions add column if not exists car_type text;
alter table public.transactions add column if not exists road_type text;
alter table public.transactions add column if not exists distance_km numeric;
alter table public.transactions add column if not exists fuel_type text;
alter table public.transactions add column if not exists price_per_liter numeric;
alter table public.transactions add column if not exists consumption numeric;
alter table public.transactions add column if not exists total_value numeric;

-- 4. Atualiza Políticas de Acesso
drop policy if exists "Enable all for users based on user_id" on public.transactions;
drop policy if exists "Users own select" on public.transactions;
drop policy if exists "Users own insert" on public.transactions;
drop policy if exists "Users own update" on public.transactions;
drop policy if exists "Users own delete" on public.transactions;

create policy "Users own select" on public.transactions for select using (auth.uid() = user_id);
create policy "Users own insert" on public.transactions for insert with check (auth.uid() = user_id);
create policy "Users own update" on public.transactions for update using (auth.uid() = user_id);
create policy "Users own delete" on public.transactions for delete using (auth.uid() = user_id);
`;

const App: React.FC = () => {
  // User Session State
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'expenses' | 'fuel' | 'tolls' | 'statement' | 'reports' | 'instructions'>('instructions'); // Default to instructions for clarity
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Data State
  const [state, setState] = useState<AppState>({
    transactions: [],
    operations: []
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncingOps, setIsSyncingOps] = useState(false);
  
  // Configuration State
  const [dbError, setDbError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');

  // Check initial session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUserEmail(user.email || '');
          setCurrentUserId(user.id);
        }
      } catch (error) {
        console.log("No active session");
      }
    };
    
    // Carregar configs salvas ou padrão
    setSbUrl(localStorage.getItem(STORAGE_KEY_URL) || '');
    setSbKey(localStorage.getItem(STORAGE_KEY_KEY) || '');
    
    checkSession();
  }, []);

  // Load user data from Supabase when userId changes
  useEffect(() => {
    if (currentUserId) {
      loadData();
    }
  }, [currentUserId]);

  const saveConfig = () => {
      if(!sbUrl || !sbKey) {
          alert("Preencha URL e Chave");
          return;
      }
      localStorage.setItem(STORAGE_KEY_URL, sbUrl);
      localStorage.setItem(STORAGE_KEY_KEY, sbKey);
      initSupabase(); // Reinicializa o client
      window.location.reload(); // Recarrega para limpar estados antigos
  };

  const loadData = async () => {
    if (!currentUserId) return;
    setIsLoaded(false);
    setDbError(null);
    
    try {
      const transactions = await dbService.getTransactions(currentUserId);
      setState(prev => ({ ...prev, transactions }));
      
      const savedOps = localStorage.getItem('caixinha_ops_cache');
      if (savedOps) {
          setState(prev => ({ ...prev, operations: JSON.parse(savedOps) }));
      }
    } catch (error: any) {
      console.error("Erro no App (loadData):", error);
      if (error.message === 'TABLE_NOT_FOUND') {
        setDbError('TABLE_NOT_FOUND');
      } else {
        console.warn("Erro de conexão ou autenticação:", error);
      }
    } finally {
      setIsLoaded(true);
    }
  };

  // Dark Mode Effect
  useEffect(() => {
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleLogin = (email: string, userId: string) => {
    setCurrentUserEmail(email);
    setCurrentUserId(userId);
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUserEmail(null);
    setCurrentUserId(null);
    setActiveTab('expenses');
    setIsLoaded(false);
    setDbError(null);
    setState({ transactions: [], operations: [] });
  };

  // Google Sheets Sync Logic
  const fetchGoogleSheetsOperations = async (sheetName: string = 'JANEIRO') => {
    if (isSyncingOps) return;
    setIsSyncingOps(true);
    
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Falha ao acessar planilha do Google.");
      
      const text = await response.text();
      const workbook = XLSX.read(text, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      const extractedOps: string[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row) continue;
        const colD = row[3];
        if (colD) {
            const val = String(colD).replace(/^"|"$/g, '').trim();
            if (val.length > 0) extractedOps.push(val);
        }
      }

      const uniqueOps = Array.from(new Set(extractedOps)).filter(op => op.length > 0 && op !== 'undefined').sort();

      if (uniqueOps.length > 0) {
        setState(prev => ({ ...prev, operations: uniqueOps }));
        localStorage.setItem('caixinha_ops_cache', JSON.stringify(uniqueOps));
        alert(`Sincronizado com sucesso! ${uniqueOps.length} operações carregadas.`);
      } else {
        alert(`Nenhuma operação encontrada na coluna D da aba ${sheetName}.`);
      }
    } catch (error) {
      console.error("Erro ao sincronizar Google Sheets:", error);
      alert("Erro ao sincronizar. Verifique se o nome da aba (Mês) existe na planilha.");
    } finally {
      setIsSyncingOps(false);
    }
  };

  const addTransaction = async (transaction: Transaction) => {
    if (!currentUserId) return;
    try {
      // Salva no Supabase
      const savedTransaction = await dbService.addTransaction(transaction, currentUserId);
      
      // Atualiza estado local
      setState(prev => ({
        ...prev,
        transactions: [savedTransaction, ...prev.transactions]
      }));
    } catch (error: any) {
      if (error.message === 'TABLE_NOT_FOUND') {
          setDbError('TABLE_NOT_FOUND');
      } else {
          // Log detalhado para debug
          const msg = error.message || JSON.stringify(error);
          alert(`Erro ao salvar no banco de dados:\n\n${msg}`);
      }
    }
  };

  const addBulkTransactions = async (expenses: Expense[]) => {
      if (!currentUserId) return;
      try {
        const savedTransactions = await dbService.addBulkTransactions(expenses, currentUserId);
        setState(prev => ({
            ...prev,
            transactions: [...savedTransactions, ...prev.transactions]
        }));
      } catch (error: any) {
        if (error.message === 'TABLE_NOT_FOUND') {
            setDbError('TABLE_NOT_FOUND');
        } else {
            const msg = error.message || JSON.stringify(error);
            alert(`Erro ao importar transações em massa:\n\n${msg}`);
        }
      }
  };

  const deleteTransaction = useCallback(async (id: string) => {
    if (!currentUserId) return;
    try {
      await dbService.deleteTransaction(id);
      setState(currentState => ({
        ...currentState,
        transactions: currentState.transactions.filter(item => item.id !== id)
      }));
    } catch (error: any) {
      const msg = error.message || JSON.stringify(error);
      alert(`Erro ao excluir transação:\n\n${msg}`);
    }
  }, [currentUserId]);

  const updateTransaction = async (updatedTransaction: Transaction) => {
    if (!currentUserId) return;
    try {
      await dbService.updateTransaction(updatedTransaction.id, updatedTransaction, currentUserId);
      setState(prev => ({
        ...prev,
        transactions: prev.transactions.map(t => t.id === updatedTransaction.id ? updatedTransaction : t)
      }));
    } catch (error: any) {
       if (error.message === 'TABLE_NOT_FOUND') {
            setDbError('TABLE_NOT_FOUND');
       } else {
            const msg = error.message || JSON.stringify(error);
            alert(`Erro ao atualizar transação:\n\n${msg}`);
       }
    }
  };

  const updateOperations = (newOps: string[]) => {
    const unique = Array.from(new Set([...state.operations, ...newOps])).sort();
    setState(prev => ({ ...prev, operations: unique }));
    localStorage.setItem('caixinha_ops_cache', JSON.stringify(unique));
  };

  const clearData = async () => {
    if (confirm("ATENÇÃO: Isso apagará TODOS os seus dados no servidor. Tem certeza?")) {
      if (!currentUserId) return;
      alert("Para limpar o banco, use o painel do Supabase. Por segurança, não permitimos 'Drop All' via App.");
    }
  };

  // --- CONFIG SCREEN (MODAL) ---
  if (showConfig) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
            <div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
                <h1 className="text-2xl font-bold mb-6 text-orange-500">Configurar Conexão</h1>
                <p className="text-sm text-gray-400 mb-6">Insira os dados do seu projeto Supabase (Settings > API).</p>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1">Project URL</label>
                        <input value={sbUrl} onChange={e => setSbUrl(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder="https://xyz.supabase.co" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1">Anon / Public Key</label>
                        <input value={sbKey} onChange={e => setSbKey(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder="eyJh..." />
                    </div>
                    <button onClick={saveConfig} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded">
                        Salvar e Conectar
                    </button>
                    <button onClick={() => setShowConfig(false)} className="w-full text-gray-400 text-sm mt-2 hover:text-white">Cancelar</button>
                </div>
            </div>
        </div>
      );
  }

  if (!currentUserId) {
    return <Login onLogin={handleLogin} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)} />;
  }

  // --- DB SETUP SCREEN (TABLE MISSING) ---
  if (dbError === 'TABLE_NOT_FOUND') {
    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
            <div className="max-w-3xl w-full bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
                <div className="bg-orange-600 p-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Atualizar Banco de Dados</h1>
                        <p className="text-orange-100 mt-1">Sua tabela precisa de colunas novas para funcionar.</p>
                    </div>
                </div>
                <div className="p-8 space-y-6">
                    <p className="text-gray-300 text-sm">
                        Detectamos que a tabela existe, mas faltam colunas (ex: car_type).<br/>
                        Copie o código SQL abaixo e execute no <strong>SQL Editor</strong> do seu painel Supabase.
                    </p>
                    
                    <div className="relative">
                        <pre className="bg-black p-4 rounded-lg text-xs text-green-400 font-mono overflow-auto max-h-64 whitespace-pre-wrap border border-gray-700 shadow-inner">
                            {SETUP_SQL}
                        </pre>
                        <button 
                            onClick={() => {navigator.clipboard.writeText(SETUP_SQL); alert("SQL Copiado para a área de transferência!");}}
                            className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded border border-gray-500"
                        >
                            Copiar SQL
                        </button>
                    </div>

                    <div className="pt-4 flex justify-between items-center border-t border-gray-700 mt-4">
                        <p className="text-xs text-gray-500">Após rodar o script no Supabase, clique em Verificar.</p>
                        <button 
                            onClick={loadData}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg transform active:scale-95 transition-transform"
                        >
                            Verificar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-10 border-b dark:border-gray-800 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold mr-2 shadow-md">
              C
            </div>
            <div>
               <h1 className="text-lg font-bold text-gray-800 dark:text-white leading-none">Caixinha CMS</h1>
               <p className="text-[10px] text-gray-500 dark:text-gray-400">{currentUserEmail}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={() => setShowConfig(true)} className="text-gray-400 hover:text-orange-500" title="Configurar Conexão">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <button onClick={handleLogout} className="text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-500">
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 py-6">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'instructions' && (
              <div className="animate-fade-in">
                  <Instructions />
              </div>
          )}

          {activeTab === 'expenses' && (
            <div className="animate-fade-in max-w-3xl mx-auto">
              <ReceiptScanner 
                operations={state.operations} 
                onSave={addTransaction} 
              />
              
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4">Últimos Lançamentos</h3>
                <div className="space-y-3">
                  {state.transactions.filter(t => t.type === 'receipt').slice(0, 3).map(t => {
                     const exp = t as Expense;
                     return (
                      <div key={exp.id} className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm border-l-4 border-orange-500 flex justify-between items-center transition-colors">
                        <div>
                          <p className="font-bold text-gray-800 dark:text-gray-200">{exp.category}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(exp.date).toLocaleDateString('pt-BR')} • {exp.city}</p>
                        </div>
                        <span className="font-mono font-bold text-orange-600 dark:text-orange-500">R$ {exp.amount.toFixed(2)}</span>
                      </div>
                     );
                  })}
                  {state.transactions.filter(t => t.type === 'receipt').length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-4">Nenhuma despesa registrada.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fuel' && (
            <div className="animate-fade-in max-w-3xl mx-auto">
              <FuelCalculator 
                operations={state.operations} 
                onSave={addTransaction} 
              />
               <div className="mt-8">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4">Últimos Abastecimentos</h3>
                <div className="space-y-3">
                  {state.transactions.filter(t => t.type === 'fuel').slice(0, 3).map(t => {
                     const fuel = t as FuelEntry;
                     return (
                      <div key={fuel.id} className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm border-l-4 border-gray-500 dark:border-gray-600 flex justify-between items-center transition-colors">
                        <div>
                          <p className="font-bold text-gray-800 dark:text-gray-200">{fuel.origin} ➝ {fuel.destination}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(fuel.date).toLocaleDateString('pt-BR')} • {fuel.carType}</p>
                        </div>
                        <span className="font-mono font-bold text-gray-800 dark:text-gray-300">R$ {fuel.totalValue.toFixed(2)}</span>
                      </div>
                     );
                  })}
                   {state.transactions.filter(t => t.type === 'fuel').length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-4">Nenhum registro de combustível.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'tolls' && (
              <div className="animate-fade-in">
                  <TollParkingImport onSaveBulk={addBulkTransactions} />
              </div>
          )}

          {activeTab === 'statement' && (
             <div className="animate-fade-in">
                <StatementView 
                  transactions={state.transactions} 
                  operations={state.operations}
                  onDelete={deleteTransaction}
                  onUpdate={updateTransaction}
                />
             </div>
          )}

          {activeTab === 'reports' && (
            <div className="animate-fade-in max-w-3xl mx-auto">
              <ReportSettings 
                transactions={state.transactions} 
                operations={state.operations} 
                onSetOperations={updateOperations} 
                onClearData={clearData}
                onSyncGoogle={fetchGoogleSheetsOperations}
                isSyncing={isSyncingOps}
                userEmail={currentUserEmail}
              />
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe transition-colors duration-300 z-50">
        <div className="max-w-6xl mx-auto grid grid-cols-6 h-16">
          <button 
            onClick={() => setActiveTab('instructions')}
            className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'instructions' ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-[9px] sm:text-xs font-medium truncate w-full text-center">Início</span>
          </button>

          <button 
            onClick={() => setActiveTab('expenses')}
            className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'expenses' ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="text-[9px] sm:text-xs font-medium truncate w-full text-center">Despesas</span>
          </button>

          <button 
            onClick={() => setActiveTab('fuel')}
            className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'fuel' ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <span className="text-[9px] sm:text-xs font-medium truncate w-full text-center">Combust.</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('tolls')}
            className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'tolls' ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[9px] sm:text-xs font-medium leading-none text-center truncate w-full">Pedágio</span>
          </button>

          <button 
            onClick={() => setActiveTab('statement')}
            className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'statement' ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            <span className="text-[9px] sm:text-xs font-medium truncate w-full text-center">Extrato</span>
          </button>

          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'reports' ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[9px] sm:text-xs font-medium truncate w-full text-center">Ajustes</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
