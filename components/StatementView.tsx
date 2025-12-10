
import React, { useState, useEffect } from 'react';
import { Transaction, Expense, FuelEntry, ExpenseCategory } from '../types';
import * as XLSX from 'xlsx';

interface StatementViewProps {
  transactions: Transaction[];
  operations: string[];
  onDelete: (id: string) => void;
  onUpdate: (t: Transaction) => void;
}

const StatementView: React.FC<StatementViewProps> = ({ transactions, operations, onDelete, onUpdate }) => {
  
  const [editingItem, setEditingItem] = useState<Transaction | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // --- DASHBOARD CALCULATION ---
  const calculateDashboard = () => {
    const totals: Record<string, number> = {};
    let totalGeneral = 0;
    
    // Track Fuel specific metrics
    let totalFuelCalculated = 0;
    let totalFuelReceipts = 0;

    transactions.forEach(t => {
        let cat = '';
        let amount = 0;

        if (t.type === 'receipt') {
            cat = t.category as string;
            amount = t.amount;
        } else {
            cat = 'Combustível';
            amount = t.totalValue; // Calculated value for general dashboard
            
            // Fuel specific tracking
            totalFuelCalculated += t.totalValue;
            totalFuelReceipts += (t as FuelEntry).receiptAmount || 0;
        }

        if (!totals[cat]) totals[cat] = 0;
        totals[cat] += amount;
        totalGeneral += amount;
    });

    return { totals, totalGeneral, totalFuelCalculated, totalFuelReceipts };
  };

  const { totals, totalGeneral, totalFuelCalculated, totalFuelReceipts } = calculateDashboard();
  const sortedCategories = Object.keys(totals).filter(c => c !== 'Combustível').sort((a, b) => totals[b] - totals[a]);


  // --- Event Handlers ---
  const handleRequestDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(id);
  };
  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation(); onDelete(id); setConfirmDeleteId(null);
  };
  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null);
  };
  const handleEditItem = (e: React.MouseEvent, t: Transaction) => {
    e.preventDefault(); e.stopPropagation(); setEditingItem({ ...t }); 
  };
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      onUpdate(editingItem);
      setEditingItem(null);
    }
  };

  useEffect(() => {
    if (editingItem && editingItem.type === 'fuel') {
       const fuel = editingItem as FuelEntry;
       if (fuel.distanceKm && fuel.pricePerLiter && fuel.consumption) {
         const newVal = (fuel.distanceKm / fuel.consumption) * fuel.pricePerLiter;
         setEditingItem({ ...fuel, totalValue: parseFloat(newVal.toFixed(2)) });
       }
    }
  }, [
    (editingItem as FuelEntry)?.distanceKm, 
    (editingItem as FuelEntry)?.pricePerLiter, 
    (editingItem as FuelEntry)?.consumption
  ]);

  const handleExportExcel = () => {
    if (sortedTransactions.length === 0) {
      alert("Não há dados para exportar.");
      return;
    }
    const dataForExcel = sortedTransactions.map(t => {
      if (t.type === 'receipt') {
        return {
          "Data": formatDate(t.date),
          "Cidade": t.city,
          "Valor": t.amount,
          "Tipo": t.category,
          "Operação": t.operation,
          "Obs": t.notes,
        };
      } else {
        return {
          "Data": formatDate(t.date),
          "Cidade": `${t.origin} -> ${t.destination}`,
          "Valor": t.totalValue,
          "Tipo": 'Combustível',
          "Operação": t.operation,
          "Obs": `Nota Fiscal: R$ ${(t as FuelEntry).receiptAmount || 0}`,
        };
      }
    });
    const ws = XLSX.utils.json_to_sheet(dataForExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `Relatorio_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 relative">

      {/* DASHBOARD */}
      {transactions.length > 0 && (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Resumo Financeiro</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total General Card */}
                <div className="bg-gradient-to-br from-orange-500 to-orange-700 text-white p-4 rounded-lg shadow-lg">
                    <div className="text-orange-100 text-xs font-bold uppercase mb-1">Total Apropriado</div>
                    <div className="text-3xl font-bold">{formatCurrency(totalGeneral)}</div>
                    <div className="text-[10px] text-orange-200 mt-1">Soma de todos os reembolsos</div>
                </div>

                {/* Fuel Comparison Card */}
                {totalFuelCalculated > 0 && (
                     <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm col-span-1 md:col-span-2">
                        <div className="text-blue-800 dark:text-blue-200 text-xs font-bold uppercase mb-3">Análise de Combustível</div>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Total Notas (Comprovantes)</div>
                                <div className="text-xl font-bold text-gray-700 dark:text-gray-200">{formatCurrency(totalFuelReceipts)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-500 dark:text-gray-400">Total Apropriado (Cálculo)</div>
                                <div className="text-xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(totalFuelCalculated)}</div>
                            </div>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                             <div 
                                className={`h-1.5 rounded-full ${totalFuelReceipts >= totalFuelCalculated ? 'bg-green-500' : 'bg-red-500'}`} 
                                style={{ width: `${Math.min((totalFuelReceipts / (totalFuelCalculated || 1)) * 100, 100)}%` }}
                             ></div>
                        </div>
                        <div className="mt-1 text-[10px] text-right">
                            {totalFuelReceipts >= totalFuelCalculated 
                                ? <span className="text-green-600 font-bold">OK: Notas cobrem o valor calculado.</span> 
                                : <span className="text-red-500 font-bold">ATENÇÃO: Notas abaixo do valor calculado.</span>}
                        </div>
                     </div>
                )}
            </div>
            
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 border-b border-gray-100 dark:border-gray-800 pb-2">Outras Categorias</h3>
            <div className="flex flex-wrap gap-3">
                {sortedCategories.map(cat => (
                    totals[cat] > 0 && (
                        <div key={cat} className="bg-gray-50 dark:bg-gray-800 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 flex-1 min-w-[140px]">
                            <div className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase truncate">{cat}</div>
                            <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{formatCurrency(totals[cat])}</div>
                        </div>
                    )
                ))}
            </div>
          </div>
      )}
      
      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setEditingItem(null)}>
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="bg-orange-600 p-4 flex justify-between items-center">
               <h3 className="text-white font-bold">
                 {editingItem.operation === 'PENDENTE - DEFINIR' ? 'Validar Lançamento' : 'Editar Lançamento'}
               </h3>
               <button type="button" onClick={() => setEditingItem(null)} className="text-white hover:bg-orange-700 p-1 rounded">
                 <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
             </div>
             
             <div className="p-6 overflow-y-auto custom-scrollbar">
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Data</label>
                      <input type="date" required value={editingItem.date} onChange={e => setEditingItem({...editingItem, date: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Operação</label>
                      <select 
                        required 
                        value={editingItem.operation === 'PENDENTE - DEFINIR' ? '' : editingItem.operation} 
                        onChange={e => setEditingItem({...editingItem, operation: e.target.value})} 
                        className={`w-full p-2 border rounded bg-white dark:bg-gray-800 dark:text-white ${editingItem.operation === 'PENDENTE - DEFINIR' ? 'border-yellow-500 ring-2 ring-yellow-200' : 'border-gray-300 dark:border-gray-700'}`}
                      >
                          <option value="">Selecione a Operação...</option>
                          {operations.length === 0 && <option value="Geral">Geral</option>}
                          {operations.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                    </div>
                  </div>

                  {editingItem.type === 'receipt' ? (
                    <>
                       <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Valor (R$)</label>
                          <input type="number" step="0.01" required value={(editingItem as Expense).amount} onChange={e => setEditingItem({...editingItem, amount: parseFloat(e.target.value)} as Expense)} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white font-mono" />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Cidade</label>
                          <input type="text" required value={(editingItem as Expense).city} onChange={e => setEditingItem({...editingItem, city: e.target.value} as Expense)} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white" />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Categoria</label>
                          <select value={(editingItem as Expense).category} onChange={e => setEditingItem({...editingItem, category: e.target.value} as Expense)} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white">
                              {Object.values(ExpenseCategory).map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                              ))}
                          </select>
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Observações</label>
                          <textarea rows={3} value={(editingItem as Expense).notes} onChange={e => setEditingItem({...editingItem, notes: e.target.value} as Expense)} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white" />
                       </div>
                    </>
                  ) : (
                    <>
                      {/* FUEL EDITING */}
                      <div>
                          <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Valor da Nota Fiscal (R$)</label>
                          <input type="number" step="0.01" value={(editingItem as FuelEntry).receiptAmount || 0} onChange={e => setEditingItem({...editingItem, receiptAmount: parseFloat(e.target.value)} as FuelEntry)} className="w-full p-2 border border-blue-200 dark:border-blue-700 rounded bg-blue-50 dark:bg-gray-800 dark:text-white font-mono" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Origem</label>
                            <input type="text" required value={(editingItem as FuelEntry).origin} onChange={e => setEditingItem({...editingItem, origin: e.target.value} as FuelEntry)} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Destino</label>
                            <input type="text" required value={(editingItem as FuelEntry).destination} onChange={e => setEditingItem({...editingItem, destination: e.target.value} as FuelEntry)} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Km</label>
                              <input type="number" step="0.1" required value={(editingItem as FuelEntry).distanceKm} onChange={e => setEditingItem({...editingItem, distanceKm: parseFloat(e.target.value)} as FuelEntry)} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">R$ / L</label>
                              <input type="number" step="0.01" required value={(editingItem as FuelEntry).pricePerLiter} onChange={e => setEditingItem({...editingItem, pricePerLiter: parseFloat(e.target.value)} as FuelEntry)} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Km/L</label>
                              <input type="number" step="0.1" required value={(editingItem as FuelEntry).consumption} onChange={e => setEditingItem({...editingItem, consumption: parseFloat(e.target.value)} as FuelEntry)} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white" />
                          </div>
                      </div>
                    </>
                  )}
                  
                  <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setEditingItem(null)} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded font-medium hover:bg-gray-300 dark:hover:bg-gray-600">Cancelar</button>
                    <button type="submit" className="flex-1 py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700 shadow">
                        Salvar
                    </button>
                  </div>
                </form>
             </div>
          </div>
        </div>
      )}

      {/* List Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm">
        <div>
           <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
             <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
             Extrato de Lançamentos
           </h2>
        </div>
        <button 
          onClick={handleExportExcel}
          className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
          Baixar Excel (.xls)
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-orange-50 dark:bg-gray-800 text-orange-800 dark:text-orange-200 uppercase font-bold text-xs">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Operação</th>
                <th className="px-4 py-3">Observação</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedTransactions.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Nenhum lançamento encontrado.</td></tr>
              ) : (
                sortedTransactions.map((t) => {
                  let displayAmount = 0;
                  let displayCity: React.ReactNode = '';
                  let displayCategory = '';
                  let displayNotes = '';
                  let displayCategoryClass = '';

                  if (t.type === 'receipt') {
                      displayAmount = t.amount;
                      displayCity = t.city;
                      displayCategory = t.category as string;
                      displayNotes = t.notes;
                      displayCategoryClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
                  } else {
                      displayAmount = t.totalValue;
                      displayCity = <span className="text-xs">{t.origin} <span className="text-orange-400">➝</span> {t.destination}</span>;
                      displayCategory = 'Combustível';
                      displayNotes = `Nota: R$ ${(t as FuelEntry).receiptAmount || 0}`;
                      displayCategoryClass = 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
                  }

                  const isConfirming = confirmDeleteId === t.id;
                  const isPending = t.operation === 'PENDENTE - DEFINIR';

                  return (
                    <tr key={t.id} className={`${isConfirming ? 'bg-red-50 dark:bg-red-900/20' : (isPending ? 'bg-yellow-50 dark:bg-yellow-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50')} transition-colors text-gray-700 dark:text-gray-300`}>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.date)}</td>
                      <td className="px-4 py-3">{displayCity}</td>
                      <td className="px-4 py-3 font-mono text-orange-600 dark:text-orange-500">{formatCurrency(displayAmount)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${displayCategoryClass}`}>{displayCategory}</span></td>
                      <td className={`px-4 py-3 font-medium ${isPending ? 'text-yellow-600 font-bold' : ''}`}>{t.operation}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{displayNotes}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                            {isConfirming ? (
                               <div className="flex space-x-2">
                                 <button onClick={(e) => handleConfirmDelete(e, t.id)} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold">Sim</button>
                                 <button onClick={handleCancelDelete} className="px-3 py-1 bg-gray-300 text-gray-800 rounded text-xs font-bold">Não</button>
                               </div>
                            ) : (
                               <>
                                <button type="button" onClick={(e) => handleEditItem(e, t)} className="text-blue-500 hover:text-blue-700 p-2"><svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                <button type="button" onClick={(e) => handleRequestDelete(e, t.id)} className="text-red-500 hover:text-red-700 p-2"><svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                               </>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Mobile view logic remains mostly same but uses displayAmount logic defined inside map */}
      <div className="block sm:hidden space-y-4">
        {sortedTransactions.map(t => {
           // ... (same logic as before for mobile cards, reusing new fields if needed)
           let displayAmount = t.type === 'receipt' ? (t as Expense).amount : (t as FuelEntry).totalValue;
           let displayCategory = t.type === 'receipt' ? (t as Expense).category : 'Combustível';
           const isConfirming = confirmDeleteId === t.id;
           return (
                <div key={t.id} className={`bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border-l-4 ${isConfirming ? 'border-red-500' : 'border-orange-500'}`}>
                    <div className="flex justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">{formatDate(t.date)}</span>
                        <span className="text-sm font-bold text-orange-600">{formatCurrency(displayAmount)}</span>
                    </div>
                    <div className="mb-2">
                        <div className="font-semibold text-gray-800 dark:text-white">{displayCategory}</div>
                        <div className="text-xs text-gray-500">{t.operation}</div>
                    </div>
                    {/* Action buttons same as before */}
                     <div className="flex justify-end gap-2 mt-2">
                        {isConfirming ? (
                             <button onClick={(e) => handleConfirmDelete(e, t.id)} className="text-xs bg-red-600 text-white px-3 py-1 rounded">Confirmar</button>
                        ) : (
                             <>
                              <button onClick={(e) => handleEditItem(e, t)} className="text-blue-500 p-1">Editar</button>
                              <button onClick={(e) => handleRequestDelete(e, t.id)} className="text-red-500 p-1">Excluir</button>
                             </>
                        )}
                     </div>
                </div>
           );
        })}
      </div>

    </div>
  );
};

export default StatementView;
