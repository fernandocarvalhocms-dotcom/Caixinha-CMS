import React, { useState } from 'react';
import { Transaction, Expense, FuelEntry } from '../types';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

interface ReportSettingsProps {
  transactions: Transaction[];
  operations: string[];
  onSetOperations: (ops: string[]) => void;
  onClearData: () => void;
}

const ReportSettings: React.FC<ReportSettingsProps> = ({ transactions, operations, onSetOperations, onClearData }) => {
  const [importText, setImportText] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleImportOperations = () => {
    // Simple split by newlines or commas
    const ops = importText.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);
    if (ops.length > 0) {
      onSetOperations(ops);
      setImportText('');
      alert(`${ops.length} operações importadas com sucesso!`);
    } else {
      alert("Nenhuma operação encontrada no texto.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const ops = text.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);
        if (ops.length > 0) {
            onSetOperations(ops);
            alert(`${ops.length} operações importadas do arquivo de texto!`);
        }
    };
    reader.readAsText(file);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const arrayBuffer = evt.target?.result;
      if (arrayBuffer) {
        try {
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert sheet to JSON (array of arrays) to handle columns
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          // Flatten the array and filter valid strings
          // This assumes operations are listed in the first column or just listed in the sheet
          const ops: string[] = [];
          
          jsonData.forEach(row => {
            row.forEach(cell => {
              if (cell && typeof cell === 'string' && cell.trim().length > 0) {
                ops.push(cell.trim());
              } else if (cell && typeof cell === 'number') {
                ops.push(String(cell));
              }
            });
          });

          if (ops.length > 0) {
            onSetOperations(ops);
            alert(`${ops.length} operações importadas do Excel com sucesso!`);
          } else {
            alert("Nenhum dado válido encontrado na planilha.");
          }
        } catch (error) {
          console.error("Erro ao ler Excel:", error);
          alert("Erro ao processar o arquivo Excel. Verifique o formato.");
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportCSV = () => {
    if (transactions.length === 0) {
        alert("Sem dados para exportar.");
        return;
    }

    const headers = ["Tipo", "Data", "Operacao", "Categoria/Via", "Cidade/Origem-Destino", "Valor (R$)", "Obs/Km"];
    const rows = transactions.map(t => {
        if (t.type === 'receipt') {
            const r = t as Expense;
            return ['Despesa', r.date, r.operation, r.category, r.city, r.amount.toFixed(2), `"${r.notes.replace(/"/g, '""')}"`];
        } else {
            const f = t as FuelEntry;
            return ['Combustivel', f.date, f.operation, `${f.roadType} - ${f.fuelType}`, `${f.origin} -> ${f.destination}`, f.totalValue.toFixed(2), `${f.distanceKm}km`];
        }
    });

    const csvContent = [
        headers.join(";"),
        ...rows.map(r => r.join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `caixinha_cms_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportReceiptsZip = async () => {
    setIsExporting(true);
    const zip = new JSZip();
    let count = 0;

    transactions.forEach((t, index) => {
        if (t.type === 'receipt') {
            const expense = t as Expense;
            if (expense.receiptImage) {
                // Determine extension from Base64 header
                let extension = 'jpg';
                let data = expense.receiptImage;

                // Check if it has data URI prefix
                if (data.includes('data:')) {
                    const meta = data.split(';')[0];
                    if (meta.includes('pdf')) extension = 'pdf';
                    else if (meta.includes('xml')) extension = 'xml';
                    else if (meta.includes('text')) extension = 'txt';
                    else if (meta.includes('png')) extension = 'png';
                    
                    // Remove prefix to get raw base64
                    data = data.split(',')[1];
                }

                // Create a clear filename
                const safeDate = expense.date || 'sem-data';
                const safeCat = (expense.category as string).replace(/[^a-z0-9]/gi, '_');
                const safeAmt = expense.amount.toFixed(2).replace('.', '-');
                const fileName = `${safeDate}_${safeCat}_R$${safeAmt}_${index}.${extension}`;

                zip.file(fileName, data, {base64: true});
                count++;
            }
        }
    });

    if (count === 0) {
        alert("Nenhum comprovante (imagem/pdf) encontrado para exportar.");
        setIsExporting(false);
        return;
    }

    try {
        const content = await zip.generateAsync({type: "blob"});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `comprovantes_caixinha_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("Erro ao gerar ZIP", error);
        alert("Erro ao criar arquivo ZIP.");
    } finally {
        setIsExporting(false);
    }
  };

  const totalAmount = transactions.reduce((acc, t) => {
      if (t.type === 'receipt') return acc + (t as Expense).amount;
      return acc + (t as FuelEntry).totalValue;
  }, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl p-6 text-white shadow-lg">
          <h3 className="text-orange-100 text-sm font-medium mb-1">Total de Gastos Registrados</h3>
          <div className="text-4xl font-bold mb-4">R$ {totalAmount.toFixed(2)}</div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-orange-400/30">
              <div>
                  <div className="text-orange-200 text-xs">Itens</div>
                  <div className="font-semibold text-lg">{transactions.length}</div>
              </div>
              <div>
                  <div className="text-orange-200 text-xs">Operações Ativas</div>
                  <div className="font-semibold text-lg">{operations.length}</div>
              </div>
          </div>
      </div>

      {/* Operations Import */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm transition-colors">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            Importar Operações
          </h3>
          
          <div className="space-y-6">
              
              {/* EXCEL IMPORT */}
              <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-100 dark:border-green-900/30">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <div className="shrink-0">
                        <svg className="h-10 w-10 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                    </div>
                    <div className="grow">
                         <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">Carregar arquivo Excel (.xlsx)</span>
                         <span className="block text-xs text-gray-500 dark:text-gray-400">Substituirá ou adicionará à lista existente</span>
                    </div>
                    <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handleExcelUpload} 
                        className="hidden" 
                    />
                    <div className="shrink-0 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold py-2 px-4 rounded border border-gray-300 dark:border-gray-600 shadow-sm">
                        Selecionar
                    </div>
                  </label>
              </div>

              <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 bg-white dark:bg-gray-900 text-sm text-gray-500">OU Texto Simples</span>
                  </div>
              </div>

              <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Cole a lista de operações (separadas por vírgula ou linha):</label>
                  <textarea 
                      className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg text-sm h-24 bg-white dark:bg-gray-800 dark:text-white"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Ex: Operação Alpha, Operação Beta, Projeto X"
                  />
                  <div className="flex justify-between mt-2">
                    <button onClick={handleImportOperations} className="px-4 py-2 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700">
                        Adicionar Texto
                    </button>
                    <div className="relative overflow-hidden inline-block">
                         <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                             Arquivo .txt / .csv
                         </button>
                         <input type="file" accept=".txt,.csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Operations List Preview */}
      {operations.length > 0 && (
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm transition-colors">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Operações Cadastradas</h3>
            <div className="max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-100 dark:border-gray-700 custom-scrollbar">
                <div className="flex flex-wrap gap-2">
                    {operations.map((op, idx) => (
                        <span key={idx} className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-600 dark:text-gray-300 shadow-sm">
                            {op}
                        </span>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* Export */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm transition-colors">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Dados e Exportação</h3>
        <div className="space-y-3">
            
            <button onClick={exportCSV} className="w-full flex justify-center items-center py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold shadow-sm transition-colors">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Exportar Planilha (CSV)
            </button>

            <button 
                onClick={exportReceiptsZip} 
                disabled={isExporting}
                className="w-full flex justify-center items-center py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
                {isExporting ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Gerando ZIP...
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        Baixar Comprovantes (.zip)
                    </>
                )}
            </button>
            
            <button onClick={onClearData} className="w-full py-3 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors">
                Limpar Todos os Dados
            </button>
        </div>
      </div>
      
    </div>
  );
};

export default ReportSettings;