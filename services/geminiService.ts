
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
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
    // ACESSO ESTÁTICO E EXPLÍCITO OBRIGATÓRIO PARA BUNDLERS (Vite/Vercel)
    // Não colocar dentro de try/catch ou loops, pois o compilador precisa ler a string exata.
    
    // 1. Vite (Padrão mais comum hoje)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
        // @ts-ignore
        return import.meta.env.VITE_API_KEY;
    }

    // 2. Create React App / Webpack
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_KEY) {
        return process.env.REACT_APP_API_KEY;
    }

    // 3. Node / Serverless / Vercel padrão
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
    }

    // 4. Fallbacks genéricos
    try {
        // @ts-ignore
        if (import.meta.env.API_KEY) return import.meta.env.API_KEY;
    } catch(e) {}
    
    try {
        if (process.env.VITE_API_KEY) return process.env.VITE_API_KEY;
    } catch(e) {}

    console.warn("⚠️ Nenhuma API Key encontrada. Verifique suas variáveis de ambiente (VITE_API_KEY ou API_KEY).");
    return undefined;
};

const processReceiptImage = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<any> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
      console.error("CRITICAL ERROR: No API Key found.");
      throw new Error("CHAVE DE API NÃO ENCONTRADA (403). Configure VITE_API_KEY no .env ou no painel da Vercel.");
  }
  
  if (!base64Data || base64Data.length < 50) {
      throw new Error("Imagem corrompida ou vazia antes do envio.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Limpeza agressiva para mobile
  let cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');

  const categories = Object.values(ExpenseCategory).join(", ");
  const prompt = `Extrair JSON: {date(YYYY-MM-DD), amount(number), city, category, notes}. Cats: ${categories}. Se falhar, use regex.`;

  let lastError;
  
  // Retry loop
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
                // Configurações de segurança desbloqueadas para evitar rejeição de fotos de celular
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
                ],
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        city: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                        notes: { type: Type.STRING },
                    },
                    required: [], // Permite resposta parcial
                },
            },
        });

        const text = response.text;
        
        if (!text) throw new Error("IA retornou resposta vazia.");
        
        try {
            return JSON.parse(cleanJsonString(text));
        } catch (parseError) {
            console.warn("JSON Parse Failed, using fallback regex");
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
        
        if (error.message?.includes('403') || error.message?.includes('API key')) {
             throw new Error("Erro de Permissão (403): Chave de API inválida. Verifique VITE_API_KEY.");
        }
        
        if (attempt < 3) await new Promise(res => setTimeout(res, 2000));
    }
  }
  
  throw lastError || new Error("Falha de conexão com IA. Verifique sua internet.");
};

const verifyFaceIdentity = async (referenceImageBase64: string, currentImageBase64: string): Promise<boolean> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key not found.");
  
  const ai = new GoogleGenAI({ apiKey });

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
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
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
