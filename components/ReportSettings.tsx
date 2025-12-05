
import React, { useState } from 'react';
import { Transaction, Expense, FuelEntry } from '../types';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

interface ReportSettingsProps {
  transactions: Transaction[];
  operations: string[];
  onSetOperations: (ops: string[]) => void;
  onClearData: () => void;
  onSyncGoogle?: (sheetName: string) => void;
  isSyncing?: boolean;
}

const ReportSettings: React.FC<ReportSettingsProps> = ({ transactions, operations, onSetOperations, onClearData, onSyncGoogle, isSyncing }) => {
  const [isExporting, setIsExporting] = useState(false);
  
  const months = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", 
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];
  // Default to current month if possible, else Janeiro
  const currentMonthIndex = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState(months[currentMonthIndex] || months[0]);

  const exportExcel = () => {
    if (transactions.length === 0) {
        alert("Sem dados para exportar.");
        return;
    }

    const dataForExcel = transactions.map(t => {
        if (t.type === 'receipt') {
            const r = t as Expense;
            return {
                "Tipo": "Despesa",
                "Data": r.date,
                "Operação": r.operation,
                "Categoria": r.category,
                "Cidade": r.city,
                "Valor (R$)": r.amount,
                "Observação": r.notes
            };
        } else {
            const f = t as FuelEntry;
            return {
                "Tipo": "Combustível",
                "Data": f.date,
                "Operação": f.operation,
                "Categoria": `Combustível - ${f.fuelType} (${f.roadType})`,
                "Cidade": `${f.origin} -> ${f.destination}`,
                "Valor (R$)": f.totalValue,
                "Observação": `Distância: ${f.distanceKm}km - Carro: ${f.carType}`
            };
        }
    });

    const ws = XLSX.utils.json_to_sheet(dataForExcel);
    
    // Adjust column widths slightly
    const wscols = [
        { wch: 15 }, // Tipo
        { wch: 12 }, // Data
        { wch: 30 }, // Operação
        { wch: 25 }, // Categoria
        { wch: 30 }, // Cidade
        { wch: 15 }, // Valor
        { wch: 40 }  // Obs
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Geral");
    XLSX.writeFile(wb, `Relatorio_Geral_Caixinha_${new Date().toISOString().slice(0,10)}.xlsx`);
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
            <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            Importar Operações
          </h3>
          
          {/* Google Sheets Sync */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
              <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm mb-2">Sincronizar com Google Sheets</h4>
              <a href="https://docs.google.com/spreadsheets/d/1SjHoaTjNMDPsdtOSLJB1Hte38G8w2yZCftz__Nc4d-s/edit?usp=sharing" target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline mb-3 block">Abrir Planilha</a>
              
              <div className="flex gap-2">
                <select 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="flex-1 p-2 text-sm border border-blue-200 rounded text-gray-700 dark:text-gray-200 dark:bg-gray-800"
                >
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button 
                    onClick={() => onSyncGoogle && onSyncGoogle(selectedMonth)} 
                    disabled={isSyncing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded shadow flex items-center"
                >
                    {isSyncing ? (
                        <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Sincronizando...
                        </>
                    ) : (
                        <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Sincronizar
                        </>
                    )}
                </button>
              </div>
          </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 my-8"></div>

      <div className="space-y-4">
          <div className="flex items-center justify-between">
              <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Exportar Relatório</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Baixe todos os lançamentos em Excel (.xlsx)</p>
              </div>
              <button 
                onClick={exportExcel}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Baixar Excel (.xlsx)
              </button>
          </div>

          <div className="flex items-center justify-between">
              <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Exportar Comprovantes</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Baixe todas as imagens/PDFs em ZIP</p>
              </div>
              <button 
                onClick={exportReceiptsZip}
                disabled={isExporting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow flex items-center"
              >
                {isExporting ? (
                    <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Gerando ZIP...
                    </>
                ) : (
                    <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                    Baixar ZIP
                    </>
                )}
              </button>
          </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 my-8"></div>

      <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-xl border border-red-100 dark:border-red-800">
        <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Atenção</h3>
        <p className="text-sm text-red-600 dark:text-red-300 mb-4">Esta ação apagará todos os dados de despesas e operações locais.</p>
        <button 
          onClick={onClearData}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow"
        >
          Limpar Todos os Dados
        </button>
      </div>

    </div>
  );
};

export default ReportSettings;
