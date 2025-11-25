
import React, { useState, useRef, useEffect } from 'react';
import { ExpenseCategory, Expense } from '../types';
import { processReceiptImage } from '../services/geminiService';

// Helper for UUID since we can't easily add packages
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ReceiptScannerProps {
  operations: string[];
  onSave: (expense: Expense) => void;
}

const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ operations, onSave }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Preview State
  const [preview, setPreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('image/jpeg');
  const [fileName, setFileName] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  // Camera State
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [formData, setFormData] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    city: '',
    amount: 0,
    category: ExpenseCategory.Refeicao,
    operation: operations[0] || '',
    notes: '',
  });

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // --- IMAGE COMPRESSION UTILITY (MOBILE OPTIMIZED) ---
  // Uses URL.createObjectURL instead of FileReader to avoid OutOfMemory crashes on phones
  const compressImageFile = (file: File): Promise<{ base64: string, preview: string }> => {
    return new Promise((resolve, reject) => {
      // 1. Create a lightweight reference to the file
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = objectUrl;

      img.onload = () => {
        // 2. Revoke URL immediately to free memory
        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement('canvas');
        // 800px is the sweet spot: readable by AI, but small enough for 3G/4G uploads
        const MAX_DIMENSION = 800; 
        let width = img.width;
        let height = img.height;

        // Resize logic keeping aspect ratio
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Canvas context failed"));
          return;
        }

        // 3. Fill white background (Fixes black images on some iOS formats/PNGs)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 4. Draw image
        ctx.drawImage(img, 0, 0, width, height);
        
        // 5. Compress to JPEG 0.6 (60% quality)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const cleanBase64 = dataUrl.split(',')[1];
        
        resolve({ base64: cleanBase64, preview: dataUrl });
      };
      
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset UI
    setError(null);
    setPreview(null);
    
    // Determine Type
    let mimeType = file.type;
    const lowerName = file.name.toLowerCase();
    
    if (!mimeType) {
        if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (lowerName.endsWith('.xml')) mimeType = 'text/xml';
        else if (lowerName.endsWith('.txt')) mimeType = 'text/plain';
        else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (lowerName.endsWith('.png')) mimeType = 'image/png';
    }

    setFileType(mimeType);
    setFileName(file.name);

    if (mimeType.startsWith('image/')) {
        // --- IMAGE PATH: COMPRESS ---
        setIsProcessing(true);
        try {
            const { base64, preview } = await compressImageFile(file);
            setPreview(preview);
            await processImage(base64, 'image/jpeg'); // Always send as JPEG after compression
        } catch (err) {
            console.error("Erro na compressão:", err);
            setError("Erro ao processar imagem. Tente tirar a foto novamente.");
            setIsProcessing(false);
        }
    } else {
        // --- DOCUMENT PATH: READ RAW ---
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setPreview(base64String); 
          const base64Data = base64String.split(',')[1];
          processImage(base64Data, mimeType);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleNativeCameraClick = () => {
    if (nativeCameraInputRef.current) {
      nativeCameraInputRef.current.click();
    }
  };

  // --- WEBCAM LOGIC (DESKTOP FALLBACK) ---

  const startCamera = async () => {
    try {
      setError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Try environment facing mode first
      const constraints = {
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setShowCamera(true);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
      }, 300);
    } catch (err) {
      console.error("Webcam access error:", err);
      // Fallback immediately to native input
      handleNativeCameraClick();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      // Standardize Capture Size (Same 800px logic)
      const MAX_DIMENSION = 800;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height) {
          if (width > MAX_DIMENSION) {
              height = height * (MAX_DIMENSION / width);
              width = MAX_DIMENSION;
          }
      } else {
          if (height > MAX_DIMENSION) {
              width = width * (MAX_DIMENSION / height);
              height = MAX_DIMENSION;
          }
      }

      canvas.width = Math.floor(width);
      canvas.height = Math.floor(height);
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw white bg just in case
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Compress
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const base64 = dataUrl.split(',')[1];
        
        stopCamera();
        
        setPreview(dataUrl);
        setFileType('image/jpeg');
        setFileName('Foto_Camera.jpg');

        processImage(base64, 'image/jpeg');
      }
    }
  };

  const processImage = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await processReceiptImage(base64, mimeType);
      
      if (result) {
        setFormData(prev => ({
          ...prev,
          date: result.date || prev.date,
          city: result.city || prev.city,
          amount: typeof result.amount === 'number' ? result.amount : prev.amount,
          category: result.category || prev.category,
          notes: result.notes || prev.notes,
        }));
      } else {
        console.warn("IA não retornou dados estruturados.");
        // We don't error out, we let user fill manually
      }
    } catch (err) {
      console.error(err);
      setError("Não foi possível ler os dados automaticamente. Preencha manualmente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.category) {
        alert("Preencha o valor e a categoria.");
        return;
    }

    const newExpense: Expense = {
      id: generateId(),
      type: 'receipt',
      date: formData.date!,
      city: formData.city || '',
      amount: Number(formData.amount),
      category: formData.category,
      operation: formData.operation || (operations.length > 0 ? operations[0] : 'Geral'),
      notes: formData.notes || '',
      receiptImage: preview || undefined
    };

    onSave(newExpense);
    
    // Reset
    setPreview(null);
    setFileType('image/jpeg');
    setFileName('');
    setFormData({
      date: new Date().toISOString().split('T')[0],
      city: '',
      amount: 0,
      category: ExpenseCategory.Refeicao,
      operation: operations[0] || '',
      notes: '',
    });
    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = '';
    
    alert("Despesa salva com sucesso!");
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm transition-colors">
      
      {/* Hidden Native Camera Input for Mobile */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={nativeCameraInputRef}
        onChange={handleFileChange}
        className="hidden"
        id="native-camera"
      />

      {/* Camera Modal Overlay (Webcam Fallback) */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
             <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="absolute inset-0 w-full h-full object-contain"
             />
             <div className="absolute top-10 text-white bg-black/50 px-4 py-2 rounded-full text-sm font-medium pointer-events-none text-center backdrop-blur-sm">
                Posicione a nota fiscal
             </div>
          </div>
          <div className="bg-gray-900 p-8 flex items-center justify-between pb-safe safe-area-bottom">
             <button 
               onClick={stopCamera}
               className="text-white text-sm px-6 py-3 rounded-full bg-gray-800 hover:bg-gray-700 font-medium"
             >
               Cancelar
             </button>
             <button 
               onClick={capturePhoto}
               className="w-20 h-20 bg-white rounded-full border-4 border-orange-500 shadow-xl active:scale-95 transition-transform flex items-center justify-center"
               aria-label="Capturar Foto"
             >
                <div className="w-16 h-16 bg-gray-100 rounded-full border-2 border-gray-300"></div>
             </button>
             <div className="w-20"></div>
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-white flex items-center">
        <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        Digitalizar Nota Fiscal
      </h2>

      {/* Image Input Selection */}
      {!preview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Option 1: Upload File */}
            <div>
                <input
                type="file"
                accept="image/*, application/pdf, .xml, .txt"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
                id="file-upload"
                />
                <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium text-center px-2">Galeria / PDF / XML</span>
                </label>
            </div>

            {/* Option 2: Live Camera with Fallback */}
            <div
                onClick={() => {
                   // Prefer Native Input for Mobile, WebCam for Desktop
                   // Simple heuristic: if touch device, try native first
                   const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                   if (isTouch) {
                     handleNativeCameraClick();
                   } else {
                     startCamera();
                   }
                }}
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-orange-300 dark:border-orange-800 border-dashed rounded-lg cursor-pointer bg-orange-50 dark:bg-gray-800 hover:bg-orange-100 dark:hover:bg-gray-700 transition-colors group relative"
            >
                <svg className="w-8 h-8 mb-2 text-orange-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-sm text-orange-600 dark:text-orange-400 font-bold">Tirar Foto</span>
                <span className="absolute bottom-2 text-[10px] text-gray-400 opacity-60">Câmera Nativa</span>
            </div>
        </div>
      )}

      {isProcessing && (
        <div className="mb-4 p-4 bg-orange-50 dark:bg-gray-800 text-orange-800 dark:text-orange-300 rounded-lg flex items-center animate-pulse border border-orange-100 dark:border-orange-900">
          <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <div>
              <p className="font-bold">Analisando documento...</p>
              <p className="text-xs opacity-80">Processando imagem e extraindo dados.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800 flex items-start">
          <svg className="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      {preview && (
        <div className="mb-6 relative group">
           {fileType.startsWith('image/') ? (
               <img src={preview} alt="Recibo" className="w-full h-auto max-h-96 object-contain rounded-lg shadow-md bg-gray-100" />
           ) : (
               <div className="w-full h-32 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                   <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                   <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{fileName}</p>
                   <p className="text-xs text-gray-400 uppercase">{fileType}</p>
               </div>
           )}
           <button onClick={() => {setPreview(null); setFormData(prev => ({...prev, amount:0, notes:''}));}} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg hover:bg-red-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Data</label>
                <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Valor (R$)</label>
                <input type="number" step="0.01" required value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-lg bg-white dark:bg-gray-800 dark:text-white" placeholder="0.00" />
            </div>
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Cidade</label>
            <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white" placeholder="Ex: São Paulo" />
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Categoria</label>
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ExpenseCategory})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white">
                {Object.values(ExpenseCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
            </select>
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Operação</label>
            <select required value={formData.operation} onChange={e => setFormData({...formData, operation: e.target.value})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white">
                <option value="">Selecione uma operação</option>
                {operations.length === 0 && <option value="Geral">Geral (Padrão)</option>}
                {operations.map(op => (
                    <option key={op} value={op}>{op}</option>
                ))}
            </select>
            {operations.length === 0 && <p className="text-xs text-gray-400 mt-1">Nenhuma operação importada. Vá em Ajustes.</p>}
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Observações</label>
            <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white" placeholder="Detalhes da despesa..." />
        </div>

        <button type="submit" className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow-lg transition-transform transform active:scale-95">
            Salvar Despesa
        </button>
      </form>
    </div>
  );
};

export default ReceiptScanner;
