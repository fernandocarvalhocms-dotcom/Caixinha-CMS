
import React, { useState, useEffect, useRef } from 'react';
import { FuelEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { processReceiptImage } from '../services/geminiService';

interface FuelCalculatorProps {
  operations: string[];
  onSave: (entry: FuelEntry) => void;
}

const FuelCalculator: React.FC<FuelCalculatorProps> = ({ operations, onSave }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Preview State
  const [preview, setPreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('image/jpeg');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<FuelEntry>>({
    date: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    carType: 'Proprio',
    roadType: 'Cidade',
    distanceKm: 0,
    operation: operations[0] || '',
    fuelType: 'Gasolina',
    pricePerLiter: 0,
    consumption: 10, // Default assumption
    totalValue: 0,
    receiptAmount: 0 // New field for the actual invoice value
  });

  // STRICT CALCULATION LOGIC: Total = (Distance / Consumption) * Price
  useEffect(() => {
    const { distanceKm, pricePerLiter, consumption } = formData;
    
    if (distanceKm !== undefined && pricePerLiter !== undefined && consumption && consumption > 0) {
       const calculatedValue = (distanceKm / consumption) * pricePerLiter;
       
       // Only update if the value actually changed to avoid render loops
       // Fixed to 2 decimal places for currency
       const rounded = Math.round(calculatedValue * 100) / 100;
       
       if (rounded !== formData.totalValue) {
           setFormData(prev => ({ ...prev, totalValue: rounded }));
       }
    }
  }, [formData.distanceKm, formData.pricePerLiter, formData.consumption]);

  // --- IMAGE HANDLING ---
  const compressImageFile = (file: File): Promise<{ base64: string, preview: string }> => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = objectUrl;

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        const MAX_DIMENSION = 800; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) { height *= MAX_DIMENSION / width; width = MAX_DIMENSION; }
        } else {
          if (height > MAX_DIMENSION) { width *= MAX_DIMENSION / height; height = MAX_DIMENSION; }
        }

        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);
        
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error("Context error")); return; }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const cleanBase64 = dataUrl.split(',')[1];
        resolve({ base64: cleanBase64, preview: dataUrl });
      };
      img.onerror = () => reject(new Error("Erro na imagem"));
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setPreview(null);
    setStatusMessage('');
    setFileName(file.name);
    
    let mimeType = file.type;
    const lowerName = file.name.toLowerCase();
    if (!mimeType) {
        if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
        else mimeType = 'image/jpeg';
    }
    setFileType(mimeType);

    if (mimeType.startsWith('image/') || lowerName.match(/\.(jpg|jpeg|png|webp)$/)) {
        setIsProcessing(true);
        setStatusMessage("Lendo nota fiscal...");
        try {
            const { base64, preview } = await compressImageFile(file);
            setPreview(preview);
            await processImage(base64, 'image/jpeg'); 
        } catch (err: any) {
            setError(err.message);
            setIsProcessing(false);
        }
    } else {
        // PDF
        setIsProcessing(true);
        setStatusMessage("Processando PDF...");
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setPreview(base64String); 
          const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;
          processImage(base64Data, mimeType);
        };
        reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await processReceiptImage(base64, mimeType);
      
      setFormData(prev => ({
        ...prev,
        date: result.date || prev.date,
        // HERE IS THE CHANGE:
        // We map the AI extracted 'amount' to 'receiptAmount'.
        // We DO NOT touch 'totalValue' because that must be calculated by formula.
        // We DO NOT touch 'pricePerLiter' because user must input it manually (per request).
        receiptAmount: typeof result.amount === 'number' ? result.amount : 0
      }));
      setStatusMessage("Dados extraídos! Preencha a distância e consumo.");
    } catch (err: any) {
      console.error(err);
      setError(`Erro na IA: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.totalValue || formData.totalValue <= 0 || !formData.origin || !formData.destination) {
        alert("Preencha Origem, Destino e verifique se o Valor Total foi calculado (maior que zero).");
        return;
    }

    const newEntry: FuelEntry = {
      id: uuidv4(),
      type: 'fuel',
      date: formData.date!,
      origin: formData.origin!,
      destination: formData.destination!,
      carType: formData.carType!,
      roadType: formData.roadType!,
      distanceKm: Number(formData.distanceKm),
      operation: formData.operation || (operations.length > 0 ? operations[0] : 'Geral'),
      fuelType: formData.fuelType!,
      pricePerLiter: Number(formData.pricePerLiter),
      consumption: Number(formData.consumption),
      totalValue: Number(formData.totalValue), // Reimbursement Value
      receiptAmount: Number(formData.receiptAmount || 0), // Invoice Value
      receiptImage: preview || undefined
    };

    onSave(newEntry);
    alert("Abastecimento salvo com sucesso!");
    
    // Reset
    setPreview(null);
    setFileName('');
    setFormData(prev => ({
        ...prev,
        origin: '',
        destination: '',
        distanceKm: 0,
        totalValue: 0,
        receiptAmount: 0
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = '';
  };

  const handleNativeCameraClick = () => {
    if (nativeCameraInputRef.current) {
      nativeCameraInputRef.current.click();
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm transition-colors">
      <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-white flex items-center">
        <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        Calculadora de Combustível
      </h2>

      {/* --- RECEIPT UPLOAD SECTION --- */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
         <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Comprovante de Abastecimento (Opcional)</h3>
         
         <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={nativeCameraInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <input 
            type="file" 
            accept="image/*, application/pdf" 
            onChange={handleFileChange} 
            ref={fileInputRef} 
            className="hidden" 
            id="fuel-file-upload"
          />

         {!preview ? (
             <div className="flex gap-4">
                 <button onClick={handleNativeCameraClick} type="button" className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-orange-300 dark:border-orange-800 rounded-lg bg-orange-50 dark:bg-gray-900/50 hover:bg-orange-100 transition-colors text-orange-700 dark:text-orange-400">
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-xs font-bold">Foto</span>
                 </button>
                 <label htmlFor="fuel-file-upload" className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 transition-colors text-gray-500 cursor-pointer">
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="text-xs font-bold">Arquivo</span>
                 </label>
             </div>
         ) : (
             <div className="relative">
                {fileType.startsWith('image/') ? (
                    <img src={preview} alt="Comprovante" className="w-full h-48 object-cover rounded-lg" />
                ) : (
                    <div className="w-full h-24 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg">
                        <span className="text-xs font-mono">{fileName}</span>
                    </div>
                )}
                <button type="button" onClick={() => {setPreview(null); setError(null);}} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
         )}
         
         {isProcessing && <p className="text-xs text-orange-600 mt-2 font-bold animate-pulse">{statusMessage || "Processando imagem..."}</p>}
         {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* NEW FIELD: VALOR DA NOTA */}
        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-800 mb-4">
             <label className="block text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1">Valor da Nota Fiscal (R$)</label>
             <input 
                type="number" 
                step="0.01" 
                value={formData.receiptAmount} 
                onChange={e => setFormData({...formData, receiptAmount: parseFloat(e.target.value)})} 
                className="w-full p-2 border border-blue-200 dark:border-blue-700 rounded text-lg font-semibold text-blue-900 dark:text-blue-100 bg-white dark:bg-gray-800" 
                placeholder="0.00"
             />
             <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1">Valor extraído do cupom fiscal anexado.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Data</label>
                <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded focus:ring-1 focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white" />
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Operação</label>
                <select required value={formData.operation} onChange={e => setFormData({...formData, operation: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded focus:ring-1 focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white">
                    <option value="">Selecione</option>
                    {operations.length === 0 && <option value="Geral">Geral</option>}
                    {operations.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Origem</label>
                <input type="text" required value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded focus:ring-1 focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white" />
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Destino</label>
                <input type="text" required value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded focus:ring-1 focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white" />
            </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Tipo Carro</label>
                <select value={formData.carType} onChange={e => setFormData({...formData, carType: e.target.value as any})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 dark:text-white">
                    <option value="Proprio">Próprio</option>
                    <option value="Alugado">Alugado</option>
                </select>
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Tipo Via</label>
                <select value={formData.roadType} onChange={e => setFormData({...formData, roadType: e.target.value as any})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 dark:text-white">
                    <option value="Cidade">Cidade</option>
                    <option value="Estrada">Estrada</option>
                </select>
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Combustível</label>
                <select value={formData.fuelType} onChange={e => setFormData({...formData, fuelType: e.target.value as any})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 dark:text-white">
                    <option value="Gasolina">Gasolina</option>
                    <option value="Alcool">Álcool</option>
                    <option value="Diesel">Diesel</option>
                </select>
            </div>
        </div>

        <div className="bg-orange-50 dark:bg-gray-800 p-4 rounded-lg border border-orange-100 dark:border-orange-900/30">
            <h3 className="text-orange-800 dark:text-orange-400 font-semibold text-sm mb-3">Cálculo de Reembolso</h3>
            <p className="text-[10px] text-gray-500 mb-3 italic">Fórmula: (Distância ÷ Consumo) × Preço/L</p>
            
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Distância (Km)</label>
                    <input type="number" step="0.1" required value={formData.distanceKm} onChange={e => setFormData({...formData, distanceKm: parseFloat(e.target.value)})} className="w-full p-2 border border-orange-200 dark:border-gray-600 rounded text-center font-mono bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Preço/L (R$)</label>
                    <input type="number" step="0.01" required value={formData.pricePerLiter} onChange={e => setFormData({...formData, pricePerLiter: parseFloat(e.target.value)})} className="w-full p-2 border border-orange-200 dark:border-gray-600 rounded text-center font-mono bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Consumo (Km/L)</label>
                    <input type="number" step="0.1" required value={formData.consumption} onChange={e => setFormData({...formData, consumption: parseFloat(e.target.value)})} className="w-full p-2 border border-orange-200 dark:border-gray-600 rounded text-center font-mono bg-white dark:bg-gray-700 dark:text-white" />
                </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                 <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-1">Valor Reembolso (Calculado)</label>
                 <input 
                    type="number" 
                    step="0.01" 
                    required 
                    readOnly 
                    value={formData.totalValue} 
                    className="w-full p-3 border-2 border-orange-500 rounded-lg text-2xl font-bold text-orange-600 text-center bg-gray-100 dark:bg-gray-900 cursor-not-allowed" 
                 />
            </div>
        </div>

        <button type="submit" className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow-lg transition-transform transform active:scale-95 mt-4">
            Registrar Combustível
        </button>
      </form>
    </div>
  );
};

export default FuelCalculator;
