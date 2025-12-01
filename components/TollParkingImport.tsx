
import React, { useState } from 'react';
import { Expense, ExpenseCategory } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface TollParkingImportProps {
  onSaveBulk: (expenses: Expense[]) => void;
}

const TollParkingImport: React.FC<TollParkingImportProps> = ({ onSaveBulk }) => {
  const [previewData, setPreviewData] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = (text: string) => {
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

      newExpenses.push({
        id: uuidv4(),
        type: 'receipt',
        date: formattedDate,
        amount: formattedAmount,
        category: category,
        city: `${placeName} - ${placeAddr}`.replace(/['"]+/g, ''),
        operation: 'PENDENTE - DEFINIR', // Usuário deve alterar depois
        notes: `Importado via CSV (${type})`,
        receiptImage: undefined 
      });
    }

    if (newExpenses.length === 0) {
      setError("Nenhum lançamento válido encontrado no arquivo.");
    } else {
      setPreviewData(newExpenses);
      setError(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset
    setPreviewData([]);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      parseCSV(text);
    };
    reader.onerror = () => setError("Erro ao ler o arquivo.");
    reader.readAsText(file, 'ISO-8859-1'); // Encoding comum para arquivos bancários/CSV Brasil
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
                <li>Exporte o relatório do Sem Parar / Veloe em formato <strong>.CSV</strong> (separado por ponto e vírgula).</li>
                <li>O sistema identificará automaticamente datas, valores e locais.</li>
                <li>Após importar, acesse a aba <strong>Extrato</strong> para editar a coluna "Operação" de cada lançamento.</li>
            </ul>
        </div>

        <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Clique para enviar</span> o arquivo CSV</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Suporta arquivos .CSV e .TXT</p>
                </div>
                <input type="file" accept=".csv, .txt" onChange={handleFileUpload} className="hidden" />
            </label>
        </div>
        
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
                            <th className="px-3 py-2">Local / Estabelecimento</th>
                            <th className="px-3 py-2">Operação</th>
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
                                <td className="px-3 py-2 text-orange-600 font-semibold">{item.operation}</td>
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
