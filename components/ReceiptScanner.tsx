
import React, { useState, useRef } from 'react';
import { ExpenseCategory, Expense } from '../types';
import { processReceiptImage } from '../services/geminiService';
import { processImageForAI } from '../services/imageCompressor';

// Helper simples para ID
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ReceiptScannerProps {
  operations: string[];
  onSave: (expense: Expense) => void;
}

const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ operations, onSave }) => {
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Data State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  
  const [formData, setFormData] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    city: '',
    amount: 0,
    category: ExpenseCategory.Refeicao,
    operation: operations[0] || '',
    notes: '',
  });

  // --- HANDLER PRINCIPAL DE ARQUIVO ---
  // Unifica Câmera e Galeria num único fluxo robusto
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
    
    // 1. Identificar se é imagem ou documento
    const isImage = file.type.startsWith('image/');
    
    try {
        if (isImage) {
            // FLUXO DE IMAGEM (Câmera do Celular / Galeria)
            setIsProcessing(true);
            setStatusMessage('Otimizando imagem...');
            
            // Passo A: Comprimir e Limpar
            const { base64, previewUrl } = await processImageForAI(file);
            setPreviewUrl(previewUrl);

            // Passo B: Enviar para IA
            setStatusMessage('Lendo comprovante com IA...');
            const aiData = await processReceiptImage(base64, 'image/jpeg');

            if (aiData) {
                setFormData(prev => ({
                    ...prev,
                    date: aiData.date || prev.date,
                    amount: aiData.amount || 0,
                    city: aiData.city || '',
                    category: aiData.category || prev.category,
                    notes: aiData.notes || ''
                }));
                setStatusMessage('');
            } else {
                setError("A IA não conseguiu identificar os dados. Preencha manualmente.");
            }
        } else {
            // FLUXO DE DOCUMENTO (PDF/XML)
            // Lemos como Base64 cru, mas não enviamos para IA neste exemplo simplificado 
            // ou enviamos com 'application/pdf' se a API suportar.
            // Aqui vamos focar apenas no preview e permitir salvar.
            const reader = new FileReader();
            reader.onload = () => {
                setPreviewUrl(reader.result as string);
                setFormData(prev => ({ ...prev, notes: `Arquivo: ${file.name}` }));
            };
            reader.readAsDataURL(file);
            setError("Documentos PDF/XML devem ser preenchidos manualmente no momento.");
        }
    } catch (err) {
        console.error(err);
        setError("Erro ao processar arquivo. Tente tirar a foto novamente em local iluminado.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) {
        alert("O valor da despesa é obrigatório.");
        return;
    }

    onSave({
        id: generateId(),
        type: 'receipt',
        date: formData.date!,
        city: formData.city || '',
        amount: Number(formData.amount),
        category: formData.category || ExpenseCategory.Refeicao,
        operation: formData.operation || (operations.length > 0 ? operations[0] : 'Geral'),
        notes: formData.notes || '',
        receiptImage: previewUrl || undefined
    });

    // Reset
    setPreviewUrl(null);
    setFileName('');
    setFormData({
        date: new Date().toISOString().split('T')[0],
        city: '',
        amount: 0,
        category: ExpenseCategory.Refeicao,
        operation: operations[0] || '',
        notes: ''
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    alert("Salvo com sucesso!");
  };

  const triggerCamera = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm">
      
      <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-white flex items-center">
        <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        Nova Despesa
      </h2>

      {/* ÁREA DE INPUT PRINCIPAL */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*,application/pdf"
        capture="environment" // FORÇA CÂMERA TRASEIRA NO MOBILE
        className="hidden"
      />

      {!previewUrl ? (
        <button 
          onClick={triggerCamera}
          className="w-full h-40 border-2 border-dashed border-orange-400 rounded-xl bg-orange-50 dark:bg-gray-800 flex flex-col items-center justify-center cursor-pointer hover:bg-orange-100 dark:hover:bg-gray-700 transition-colors group"
        >
            <div className="bg-orange-100 dark:bg-gray-700 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <span className="text-lg font-bold text-orange-700 dark:text-orange-400">Tirar Foto ou Escolher Arquivo</span>
            <span className="text-sm text-gray-500 mt-1">A IA preencherá os dados automaticamente</span>
        </button>
      ) : (
        <div className="mb-6 relative">
            <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-700">
                {previewUrl.startsWith('data:image') ? (
                    <img src={previewUrl} className="h-full object-contain" alt="Preview" />
                ) : (
                    <div className="text-center p-4">
                        <svg className="w-12 h-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <p className="font-bold text-gray-600 dark:text-gray-300">{fileName}</p>
                    </div>
                )}
            </div>
            <button 
                onClick={() => { setPreviewUrl(null); setFormData(prev => ({...prev, amount: 0})); }}
                className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg hover:bg-red-700"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
      )}

      {/* LOADING STATE */}
      {isProcessing && (
        <div className="my-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center animate-pulse border border-blue-100 dark:border-blue-800">
            <svg className="animate-spin h-6 w-6 text-blue-600 mr-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <div className="flex-1">
                <p className="font-bold text-blue-800 dark:text-blue-300">{statusMessage}</p>
            </div>
        </div>
      )}

      {/* ERROR MESSAGE */}
      {error && (
        <div className="my-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg border border-yellow-200 dark:border-yellow-800 flex items-start">
             <svg className="w-6 h-6 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             <p>{error}</p>
        </div>
      )}

      {/* FORMULÁRIO */}
      <form onSubmit={handleSave} className="space-y-4 mt-6">
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Data</label>
                <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Valor (R$)</label>
                <input type="number" step="0.01" required value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg font-mono text-xl font-bold text-orange-600 bg-white dark:bg-gray-800" placeholder="0.00" />
            </div>
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Cidade</label>
            <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white" />
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Categoria</label>
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ExpenseCategory})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white">
                {Object.values(ExpenseCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
            </select>
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Operação</label>
            <select required value={formData.operation} onChange={e => setFormData({...formData, operation: e.target.value})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white">
                <option value="">Selecione...</option>
                {operations.length === 0 && <option value="Geral">Geral</option>}
                {operations.map(op => (
                    <option key={op} value={op}>{op}</option>
                ))}
            </select>
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Observações</label>
            <textarea rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white" />
        </div>

        <button type="submit" className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all text-lg">
            Salvar Despesa
        </button>
      </form>
    </div>
  );
};

export default ReceiptScanner;
