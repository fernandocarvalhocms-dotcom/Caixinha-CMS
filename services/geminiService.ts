
import { GoogleGenAI, Type } from "@google/genai";
import { ExpenseCategory } from "../types";

const cleanJsonString = (str: string): string => {
  let cleaned = str.replace(/```json/g, '').replace(/```/g, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return cleaned.trim();
};

const getApiKey = (): string | undefined => {
    let key: string | undefined = undefined;

    // 1. Try Vite standard (import.meta.env)
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            if (import.meta.env.VITE_API_KEY) key = import.meta.env.VITE_API_KEY;
            // @ts-ignore
            else if (import.meta.env.API_KEY) key = import.meta.env.API_KEY;
        }
    } catch (e) { console.debug("Vite env check failed", e); }

    // 2. Try Standard Node/Webpack (process.env)
    if (!key) {
        try {
            if (typeof process !== 'undefined' && process.env) {
                if (process.env.API_KEY) key = process.env.API_KEY;
                else if (process.env.REACT_APP_API_KEY) key = process.env.REACT_APP_API_KEY;
                else if (process.env.VITE_API_KEY) key = process.env.VITE_API_KEY;
            }
        } catch (e) { console.debug("Process env check failed", e); }
    }

    // 3. Debug logging to help user
    if (!key) {
        console.warn("⚠️ API KEY NOT FOUND. Checked: import.meta.env.VITE_API_KEY, process.env.API_KEY, etc.");
    } else {
        console.debug("✅ API Key found via environment.");
    }

    return key;
};

const processReceiptImage = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<any> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
      console.error("CRITICAL ERROR: No API Key found.");
      throw new Error("CHAVE DE API NÃO ENCONTRADA (403). Crie um arquivo .env com VITE_API_KEY=sua_chave ou verifique as configurações do servidor.");
  }
  
  // SAFETY: Validate Base64 payload
  if (!base64Data || base64Data.length < 50) {
      throw new Error("Imagem corrompida ou vazia antes do envio.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // SAFETY: Aggressive Mobile Cleanup
  // Remove data URI prefix if present
  let cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  // Remove any newlines or spaces that mobile keyboards/browsers might inject
  cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');

  const categories = Object.values(ExpenseCategory).join(", ");

  const prompt = `Extrair JSON: {date(YYYY-MM-DD), amount(number), city, category, notes}. Cats: ${categories}. Se falhar, use regex.`;

  let lastError;
  // Retry loop for unstable mobile connections
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                {
                    inlineData: {
                    mimeType: mimeType,
                    data: cleanBase64,
                    },
                },
                { text: prompt },
                ],
            },
            config: {
                responseMimeType: "application/json",
                // Unblock everything for mobile photos
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
                ],
                // Loose schema
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        city: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                        notes: { type: Type.STRING },
                    },
                    required: [], 
                },
            },
        });

        const text = response.text;
        
        if (!text) throw new Error("IA retornou resposta vazia.");
        
        try {
            return JSON.parse(cleanJsonString(text));
        } catch (parseError) {
            console.warn("JSON Parse Failed, using fallback regex");
            // Basic Regex Fallback
            const amountMatch = text.match(/(\d+[.,]\d{2})/);
            return {
                amount: amountMatch ? parseFloat(amountMatch[0].replace(',', '.')) : 0,
                date: new Date().toISOString().split('T')[0],
                category: 'Refeição',
                notes: 'Leitura parcial (Erro JSON)',
                city: ''
            };
        }
    } catch (error: any) {
        console.error(`Gemini Attempt ${attempt} Error:`, error);
        lastError = error;
        
        // Don't retry if it's an Auth error
        if (error.message?.includes('403') || error.message?.includes('API key')) {
             throw new Error("Erro de Permissão (403): Chave de API inválida ou bloqueada. Verifique seu arquivo .env");
        }
        
        if (attempt < 3) await new Promise(res => setTimeout(res, 2000)); // 2s wait for mobile retry
    }
  }
  
  throw lastError || new Error("Falha de conexão com IA. Verifique sua internet.");
};

const verifyFaceIdentity = async (referenceImageBase64: string, currentImageBase64: string): Promise<boolean> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key not found.");
  
  const ai = new GoogleGenAI({ apiKey });

  // Clean data
  const cleanRef = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "").replace(/[\r\n\s]/g, '');
  const cleanCurr = currentImageBase64.replace(/^data:image\/\w+;base64,/, "").replace(/[\r\n\s]/g, '');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: {
        parts: [
          { text: "Comparar rostos. JSON { match: boolean }" },
          { inlineData: { mimeType: "image/jpeg", data: cleanRef } },
          { inlineData: { mimeType: "image/jpeg", data: cleanCurr } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        safetySettings: [
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      }
    });

    const result = JSON.parse(cleanJsonString(response.text || '{"match": false}'));
    return !!result.match;
  } catch (error) {
    console.error("Face verify error:", error);
    return false;
  }
};

export { processReceiptImage, verifyFaceIdentity };
