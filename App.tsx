
import React, { useState, useEffect, useCallback } from 'react';
import Login from './components/Login';
import ReceiptScanner from './components/ReceiptScanner';
import FuelCalculator from './components/FuelCalculator';
import ReportSettings from './components/ReportSettings';
import StatementView from './components/StatementView';
import TollParkingImport from './components/TollParkingImport';
import { Transaction, AppState, Expense, FuelEntry } from './types';
import * as XLSX from 'xlsx';
import { authService } from './services/authService';
import { dbService } from './services/dbService';

const SHEET_ID = '1SjHoaTjNMDPsdtOSLJB1Hte38G8w2yZCftz__Nc4d-s';

const App: React.FC = () => {
  // User Session State
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'expenses' | 'fuel' | 'tolls' | 'statement' | 'reports'>('expenses');
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Data State
  const [state, setState] = useState<AppState>({
    transactions: [],
    operations: []
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncingOps, setIsSyncingOps] = useState(false);

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
    checkSession();
  }, []);

  // Load user data from Supabase when userId changes
  useEffect(() => {
    if (currentUserId) {
      setIsLoaded(false);
      
      const loadData = async () => {
        try {
          const transactions = await dbService.getTransactions(currentUserId);
          setState(prev => ({ ...prev, transactions }));
          // Operations ainda carregadas do Google Sheets ou local
          // Como operações não são persistidas no banco no esquema atual, 
          // poderíamos salvar no localStorage apenas como cache de preferencia.
          const savedOps = localStorage.getItem('caixinha_ops_cache');
          if (savedOps) {
             setState(prev => ({ ...prev, operations: JSON.parse(savedOps) }));
          }
        } catch (error) {
          console.error("Erro ao carregar dados do banco:", error);
          alert("Erro ao carregar seus dados. Verifique a conexão.");
        } finally {
          setIsLoaded(true);
        }
      };
      
      loadData();
    }
  }, [currentUserId]);

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
    setState({ transactions: [], operations: [] });
  };

  // Google Sheets Sync Logic
  const fetchGoogleSheetsOperations = async (sheetName: string = 'JANEIRO') => {
    if (isSyncingOps) return;
    setIsSyncingOps(true);
    console.log(`Iniciando sincronização com Google Sheets (Aba: ${sheetName})...`);

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
    } catch (error) {
      alert("Erro ao salvar transação no banco de dados.");
      console.error(error);
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
      } catch (error) {
        alert("Erro ao importar transações em massa.");
        console.error(error);
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
    } catch (error) {
      alert("Erro ao excluir transação.");
      console.error(error);
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
    } catch (error) {
       alert("Erro ao atualizar transação.");
       console.error(error);
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
      // Precisaríamos implementar um delete all no service, mas deletar um por um ou via query é possivel.
      // Por segurança, vamos apenas limpar o estado local neste exemplo ou avisar que deve ser feito manual.
      alert("Funcionalidade de limpar tudo restrita por segurança no servidor. Exclua itens individualmente.");
    }
  };

  if (!currentUserId) {
    return <Login onLogin={handleLogin} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)} />;
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
              />
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe transition-colors duration-300 z-50">
        <div className="max-w-6xl mx-auto grid grid-cols-5 h-16">
          <button 
            onClick={() => setActiveTab('expenses')}
            className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'expenses' ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="text-[10px] sm:text-xs font-medium">Despesas</span>
          </button>

          <button 
            onClick={() => setActiveTab('fuel')}
            className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'fuel' ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <span className="text-[10px] sm:text-xs font-medium">Combust.</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('tolls')}
            className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'tolls' ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[10px] sm:text-xs font-medium leading-tight text-center">Pedágio/<br/>Estacion.</span>
          </button>

          <button 
            onClick={() => setActiveTab('statement')}
            className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'statement' ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            <span className="text-[10px] sm:text-xs font-medium">Extrato</span>
          </button>

          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'reports' ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[10px] sm:text-xs font-medium">Ajustes</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
