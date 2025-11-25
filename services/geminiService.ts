
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
    // Try standard process.env (Node/Webpack/standard Vite)
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
    }
    // Try import.meta.env (Vite standard) if available
    try {
        // @ts-ignore
        if (import.meta && import.meta.env && import.meta.env.VITE_API_KEY) {
            // @ts-ignore
            return import.meta.env.VITE_API_KEY;
        }
    } catch (e) {
        // Ignore environment access errors
    }
    return undefined;
};

const processReceiptImage = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<any> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
      console.error("CRITICAL: API Key is missing in execution environment.");
      throw new Error("Chave de API não encontrada. Verifique as configurações do servidor (API_KEY).");
  }
  
  // SAFETY: Validate Base64 payload
  if (!base64Data || base64Data.length < 100) {
      throw new Error("Imagem corrompida ou vazia antes do envio.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // SAFETY: Aggressive Mobile Cleanup
  // Remove data URI prefix if present
  let cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  // Remove any newlines or spaces that mobile keyboards/browsers might inject
  cleanBase64 = cleanBase64.replace(/\s/g, '');

  const categories = Object.values(ExpenseCategory).join(", ");

  const prompt = `Analise a imagem/documento. 
  Extraia JSON: {date (YYYY-MM-DD), amount (number), city (string), category (string), notes (string)}.
  Categorias permitidas: ${categories}.
  Se falhar algo, preencha com o que conseguir.
  Se data ilegível, use HOJE.
  Se valor ilegível, use 0.`;

  let lastError;
  // Reduce retries to 2 to fail faster on user error
  for (let attempt = 1; attempt <= 2; attempt++) {
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
        // Capture specific API Key errors
        if (error.message?.includes('403') || error.message?.includes('API key')) {
             throw new Error("Erro de Permissão (403): Chave de API inválida ou bloqueada.");
        }
        if (attempt < 2) await new Promise(res => setTimeout(res, 1000));
    }
  }
  
  throw lastError || new Error("Falha na comunicação com a IA.");
};

const verifyFaceIdentity = async (referenceImageBase64: string, currentImageBase64: string): Promise<boolean> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key not found.");
  
  const ai = new GoogleGenAI({ apiKey });

  // Clean data
  const cleanRef = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, '');
  const cleanCurr = currentImageBase64.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, '');

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
