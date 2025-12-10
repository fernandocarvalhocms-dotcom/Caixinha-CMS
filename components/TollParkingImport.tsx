
import React, { useState } from 'react';
import { Expense, ExpenseCategory } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { processTollPdf } from '../services/geminiService';
import { jsPDF } from "jspdf";

interface TollParkingImportProps {
  onSaveBulk: (expenses: Expense[]) => void;
}

const TollParkingImport: React.FC<TollParkingImportProps> = ({ onSaveBulk }) => {
  const [previewData, setPreviewData] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate a virtual PDF receipt for the CSV entry
  const generateReceiptPdf = (data: { date: string, city: string, amount: number, type: string }): string => {
      try {
          const doc = new jsPDF({
              orientation: "landscape",
              unit: "mm",
              format: [100, 60] // Small receipt size
          });
          
          doc.setFontSize(10);
          doc.text("RECIBO DE IMPORTACAO (CSV)", 5, 10);
          doc.line(5, 12, 95, 12);
          
          doc.setFontSize(8);
          doc.text(`Data: ${new Date(data.date).toLocaleDateString('pt-BR')}`, 5, 20);
          doc.text(`Local: ${data.city}`, 5, 25);
          doc.text(`Tipo: ${data.type}`, 5, 30);
          
          doc.setFontSize(12);
          doc.text(`Valor: R$ ${data.amount.toFixed(2).replace('.', ',')}`, 5, 45);
          
          doc.setFontSize(6);
          doc.text("Gerado automaticamente pelo Caixinha CMS", 5, 55);
          
          return doc.output('datauristring');
      } catch (e) {
          console.error("PDF Gen Error", e);
          return "";
      }
  };

  const parseCSV = async (text: string) => {
    const lines = text.split('\n');
    const headers = lines[0].split(';').map(h => h.trim());
    
    // Identificar índices das colunas baseadas no arquivo enviado
    const idxDate = headers.findIndex(h => h.includes('Data de Utilizacao'));
    const idxPlaceName = headers.findIndex(h => h.includes('Nome do Estabelecimento'));
    const idxPlaceAddr = headers.findIndex(h => h.includes('Endereco do Estabelecimento'));
    const idxValue = headers.findIndex(h => h.includes('Valor Cobrado'));
    const idxType = headers.findIndex(h => h.includes('Tipo de Transacao'));

    if (idxDate === -1 || idxValue === -1) {
      setError("Formato de arquivo inválido. As colunas 'Data de Utilizacao' e 'Valor Cobrado' são obrigatórias.");
      setIsProcessing(false);
      return;
    }

    const newExpenses: Expense[] = [];

    // Começar da linha 1 (ignorar header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = line.split(';');
      
      // Extrair e limpar dados
      const rawDate = cols[idxDate]; // DD/MM/YYYY
      const rawValue = cols[idxValue]; // 13,60
      const placeName = idxPlaceName > -1 ? cols[idxPlaceName] : '';
      const placeAddr = idxPlaceAddr > -1 ? cols[idxPlaceAddr] : '';
      const type = idxType > -1 ? cols[idxType] : '';

      if (!rawDate || !rawValue) continue;

      // Converter Data (DD/MM/YYYY -> YYYY-MM-DD)
      const dateParts = rawDate.split('/');
      if (dateParts.length !== 3) continue;
      const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

      // Converter Valor (13,60 -> 13.60)
      const formattedAmount = parseFloat(rawValue.replace(',', '.'));

      // Definir Categoria
      let category = ExpenseCategory.Outros; // Default type needs to be cast or added to enum if strict
      const typeUpper = type.toUpperCase();
      
      if (typeUpper.includes('PEDAGIO') || typeUpper.includes('PEDÁGIO')) {
          category = ExpenseCategory.Pedagio;
      } else if (typeUpper.includes('ESTACIONAMENTO')) {
          category = ExpenseCategory.Estacionamento;
      } else {
          // Fallback based on establishment name
          if (placeName.toUpperCase().includes('ESTACIONAMENTO') || placeName.toUpperCase().includes('SHOPPING')) {
              category = ExpenseCategory.Estacionamento;
          } else if (placeName.toUpperCase().includes('CCR') || placeName.toUpperCase().includes('VIAS')) {
              category = ExpenseCategory.Pedagio;
          } else {
              // Cast to string to allow flexibility or map to existing enum
              category = "Taxas" as ExpenseCategory; 
          }
      }

      const city = `${placeName} - ${placeAddr}`.replace(/['"]+/g, '');
      
      // GENERATE VIRTUAL RECEIPT
      const pdfBase64 = generateReceiptPdf({
          date: formattedDate,
          city: city,
          amount: formattedAmount,
          type: type || category
      });

      newExpenses.push({
        id: uuidv4(),
        type: 'receipt',
        date: formattedDate,
        amount: formattedAmount,
        category: category,
        city: city,
        operation: 'PENDENTE - DEFINIR', // Usuário deve alterar depois
        notes: `Importado via CSV (${type})`,
        receiptImage: pdfBase64 
      });
    }

    if (newExpenses.length === 0) {
      setError("Nenhum lançamento válido encontrado no arquivo.");
    } else {
      setPreviewData(newExpenses);
      setError(null);
    }
    setIsProcessing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset
    setPreviewData([]);
    setError(null);
    setIsProcessing(true);

    const fileType = file.type;

    if (fileType === 'application/pdf') {
        // Handle PDF via Gemini AI
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            try {
                const extractedData = await processTollPdf(base64String);
                
                // Map AI result to Expense type
                const mappedExpenses: Expense[] = extractedData.map((item: any) => ({
                    id: uuidv4(),
                    type: 'receipt',
                    date: item.date || new Date().toISOString().split('T')[0],
                    amount: typeof item.amount === 'number' ? item.amount : 0,
                    category: (item.category === 'Estacionamento' ? ExpenseCategory.Estacionamento : ExpenseCategory.Pedagio),
                    city: item.city || 'Local Desconhecido',
                    operation: 'PENDENTE - DEFINIR',
                    notes: 'Importado via PDF (IA)',
                    // We can reuse the original PDF here if we wanted, 
                    // but for bulk extraction it's hard to split. 
                    // We'll leave undefined or generate a summary later.
                    receiptImage: undefined 
                }));

                if (mappedExpenses.length === 0) {
                    setError("A IA não conseguiu encontrar transações neste PDF.");
                } else {
                    setPreviewData(mappedExpenses);
                }
            } catch (err: any) {
                console.error(err);
                setError(`Erro ao processar PDF: ${err.message}`);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsDataURL(file);
    } else {
        // Handle CSV/TXT locally
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const text = evt.target?.result as string;
          // Small timeout to allow UI to update to "Processing"
          setTimeout(() => parseCSV(text), 100);
        };
        reader.onerror = () => {
             setError("Erro ao ler o arquivo.");
             setIsProcessing(false);
        };
        reader.readAsText(file, 'ISO-8859-1'); // Encoding comum para arquivos bancários/CSV Brasil
    }
  };

  const confirmImport = () => {
    onSaveBulk(previewData);
    setPreviewData([]);
    alert(`${previewData.length} lançamentos importados com sucesso! Vá para a aba 'Extrato' para definir as operações.`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center mb-4">
           <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
           Importação de Pedágio e Estacionamento
        </h2>
        
        <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-100 dark:border-orange-800 mb-6">
            <p className="text-sm text-orange-800 dark:text-orange-200 mb-2 font-semibold">Instruções:</p>
            <ul className="list-disc list-inside text-xs text-orange-700 dark:text-orange-300 space-y-1">
                <li>Exporte o relatório do Sem Parar / Veloe em formato <strong>.CSV</strong>.</li>
                <li>O sistema identificará datas, valores e gerará um <strong>Comprovante PDF automático</strong> para cada item.</li>
                <li>Isso garante que o arquivo ZIP final contenha documentos para todos os lançamentos.</li>
            </ul>
        </div>

        {isProcessing ? (
             <div className="flex flex-col items-center justify-center p-12 space-y-4">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
                 <p className="text-gray-600 dark:text-gray-300 font-medium">Processando arquivo e gerando comprovantes...</p>
                 <p className="text-xs text-gray-400">Por favor, aguarde.</p>
             </div>
        ) : (
            <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Clique para enviar</span> CSV ou PDF</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Suporta arquivos .CSV, .TXT e .PDF</p>
                    </div>
                    <input type="file" accept=".csv, .txt, .pdf, application/pdf" onChange={handleFileUpload} className="hidden" />
                </label>
            </div>
        )}
        
        {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm">
                {error}
            </div>
        )}
      </div>

      {previewData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                <h3 className="font-bold text-gray-700 dark:text-gray-200">Pré-visualização ({previewData.length} itens)</h3>
                <button 
                    onClick={confirmImport}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold shadow transition-transform transform active:scale-95"
                >
                    Confirmar Importação
                </button>
            </div>
            <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase sticky top-0">
                        <tr>
                            <th className="px-3 py-2">Data</th>
                            <th className="px-3 py-2">Categoria</th>
                            <th className="px-3 py-2">Local</th>
                            <th className="px-3 py-2">Comprovante</th>
                            <th className="px-3 py-2 text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-600 dark:text-gray-400">
                        {previewData.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-3 py-2 whitespace-nowrap">{new Date(item.date).toLocaleDateString('pt-BR')}</td>
                                <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.category === 'Pedágio' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {item.category}
                                    </span>
                                </td>
                                <td className="px-3 py-2 truncate max-w-xs">{item.city}</td>
                                <td className="px-3 py-2">
                                    {item.receiptImage ? (
                                        <span className="text-green-600 font-bold flex items-center">
                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            PDF Gerado
                                        </span>
                                    ) : <span className="text-gray-400">Pendente</span>}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-gray-800 dark:text-gray-200">
                                    {item.amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default TollParkingImport;
