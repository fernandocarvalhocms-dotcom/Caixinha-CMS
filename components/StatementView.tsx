
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
  // State to track which item is currently asking for deletion confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sort transactions by date (newest first)
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

  // --- Robust Event Handlers ---

  const handleRequestDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Set this ID as pending confirmation
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Call the actual delete
    onDelete(id);
    // Reset confirmation state
    setConfirmDeleteId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const handleEditItem = (e: React.MouseEvent, t: Transaction) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingItem({ ...t }); 
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      onUpdate(editingItem);
      setEditingItem(null);
    }
  };

  // Auto-calculate total value for fuel when editing
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

    // Prepare data for Excel
    const dataForExcel = sortedTransactions.map(t => {
      if (t.type === 'receipt') {
        return {
          "Data": formatDate(t.date),
          "Cidade": t.city,
          "Valor em Reais": t.amount,
          "Tipo da Despesa": t.category,
          "Operações CMS": t.operation,
          "Observação": t.notes,
          "Valor Apropriado": t.amount
        };
      } else {
        return {
          "Data": formatDate(t.date),
          "Cidade": `${t.origin} -> ${t.destination}`,
          "Valor em Reais": t.totalValue,
          "Tipo da Despesa": 'Combustível',
          "Operações CMS": t.operation,
          "Observação": `${t.carType} - ${t.roadType} (${t.distanceKm}km)`,
          "Valor Apropriado": t.totalValue
        };
      }
    });

    const ws = XLSX.utils.json_to_sheet(dataForExcel);
    const wscols = [
      { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 15 },
    ];
    ws['!cols'] = wscols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `Relatorio_Caixinha_CMS_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 relative">
      
      {/* EDIT MODAL (unchanged structure) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setEditingItem(null)}>
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="bg-orange-600 p-4 flex justify-between items-center">
               <h3 className="text-white font-bold">Editar Lançamento</h3>
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
                      <select required value={editingItem.operation} onChange={e => setEditingItem({...editingItem, operation: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 dark:text-white">
                          <option value="">Selecione</option>
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
                    <button type="submit" className="flex-1 py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700 shadow">Salvar Alterações</button>
                  </div>
                </form>
             </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm">
        <div>
           <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
             <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
             Extrato de Lançamentos
           </h2>
           <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Visualização cronológica de todas as despesas</p>
        </div>
        <button 
          onClick={handleExportExcel}
          className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
          Baixar Excel (.xls)
        </button>
      </div>

      {/* Mobile Card View */}
      <div className="block sm:hidden space-y-4">
        {sortedTransactions.map(t => {
            let displayAmount = 0;
            let displayCity = '';
            let displayCategory = '';
            let displayNotes = '';

            if (t.type === 'receipt') {
                displayAmount = t.amount;
                displayCity = t.city;
                displayCategory = t.category as string;
                displayNotes = t.notes;
            } else {
                displayAmount = t.totalValue;
                displayCity = `${t.origin} -> ${t.destination}`;
                displayCategory = 'Combustível';
                displayNotes = `Km: ${t.distanceKm}`;
            }

            const isConfirming = confirmDeleteId === t.id;

            return (
                <div key={t.id} className={`bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border-l-4 ${isConfirming ? 'border-red-500' : 'border-orange-500'} relative group transition-all`}>
                    <div className="flex justify-between mb-2 pr-16">
                        <span className="text-xs font-bold text-gray-400 uppercase">{formatDate(t.date)}</span>
                        <span className="text-sm font-bold text-orange-600">{formatCurrency(displayAmount)}</span>
                    </div>
                    <div className="mb-2 pr-16">
                        <div className="font-semibold text-gray-800 dark:text-white">{displayCategory}</div>
                        <div className="text-xs text-gray-500">{displayCity}</div>
                    </div>
                    
                    {/* Action Buttons (Mobile) */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                        {isConfirming ? (
                          <>
                             <button 
                               type="button"
                               onClick={(e) => handleConfirmDelete(e, t.id)}
                               className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded shadow hover:bg-red-700"
                             >
                               CONFIRMAR
                             </button>
                             <button 
                               type="button"
                               onClick={handleCancelDelete}
                               className="px-3 py-1 bg-gray-300 text-gray-700 text-xs font-bold rounded shadow hover:bg-gray-400"
                             >
                               CANCELAR
                             </button>
                          </>
                        ) : (
                          <>
                             <button 
                               type="button" 
                               onClick={(e) => handleEditItem(e, t)} 
                               className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 shadow-sm active:bg-blue-200 cursor-pointer"
                             >
                                  <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                             </button>
                             <button 
                               type="button" 
                               onClick={(e) => handleRequestDelete(e, t.id)} 
                               className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 rounded-full hover:bg-red-100 shadow-sm active:bg-red-200 cursor-pointer"
                             >
                                  <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             </button>
                          </>
                        )}
                    </div>
                </div>
            );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-orange-50 dark:bg-gray-800 text-orange-800 dark:text-orange-200 uppercase font-bold text-xs">
              <tr>
                <th className="px-4 py-3 border-b dark:border-gray-700">Data</th>
                <th className="px-4 py-3 border-b dark:border-gray-700">Cidade</th>
                <th className="px-4 py-3 border-b dark:border-gray-700">Valor</th>
                <th className="px-4 py-3 border-b dark:border-gray-700">Tipo</th>
                <th className="px-4 py-3 border-b dark:border-gray-700">Operação</th>
                <th className="px-4 py-3 border-b dark:border-gray-700">Observação</th>
                <th className="px-4 py-3 border-b dark:border-gray-700 text-center min-w-[120px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedTransactions.length === 0 ? (
                  <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Nenhum lançamento encontrado.</td>
                  </tr>
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
                      displayNotes = `${t.carType} / ${t.roadType}`;
                      displayCategoryClass = 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
                  }

                  const isConfirming = confirmDeleteId === t.id;

                  return (
                    <tr key={t.id} className={`${isConfirming ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'} transition-colors text-gray-700 dark:text-gray-300`}>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.date)}</td>
                      <td className="px-4 py-3">{displayCity}</td>
                      <td className="px-4 py-3 font-mono text-orange-600 dark:text-orange-500">{formatCurrency(displayAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${displayCategoryClass}`}>
                            {displayCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{t.operation}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate" title={displayNotes}>
                        {displayNotes}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                            {isConfirming ? (
                               <div className="flex space-x-2">
                                 <button 
                                    onClick={(e) => handleConfirmDelete(e, t.id)}
                                    className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 shadow"
                                 >
                                   Sim
                                 </button>
                                 <button 
                                    onClick={handleCancelDelete}
                                    className="px-3 py-1 bg-gray-300 text-gray-800 rounded text-xs font-bold hover:bg-gray-400 shadow"
                                 >
                                   Não
                                 </button>
                               </div>
                            ) : (
                               <>
                                <button 
                                  type="button" 
                                  onClick={(e) => handleEditItem(e, t)} 
                                  className="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors cursor-pointer" 
                                  title="Editar"
                                >
                                    <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button 
                                  type="button" 
                                  onClick={(e) => handleRequestDelete(e, t.id)} 
                                  className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 dark:hover:bg-gray-700 transition-colors cursor-pointer" 
                                  title="Excluir"
                                >
                                    <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
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
    </div>
  );
};

export default StatementView;
