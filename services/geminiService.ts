
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ExpenseCategory } from "../types";

const cleanJsonString = (str: string): string => {
  let cleaned = str.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // Detect if it is an array or object
  const firstSquare = cleaned.indexOf('[');
  const firstCurly = cleaned.indexOf('{');
  
  // If array comes first (or exists and no object), assume array
  if (firstSquare !== -1 && (firstCurly === -1 || firstSquare < firstCurly)) {
    const lastSquare = cleaned.lastIndexOf(']');
    if (lastSquare !== -1) {
      return cleaned.substring(firstSquare, lastSquare + 1);
    }
  } 
  // Else if object exists
  else if (firstCurly !== -1) {
     const lastCurly = cleaned.lastIndexOf('}');
     if (lastCurly !== -1) {
       return cleaned.substring(firstCurly, lastCurly + 1);
     }
  }
  
  return cleaned;
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

  // ESTRATÉGIA ROBUSTA PARA CELULAR: TEXTO PURO (PLAIN TEXT)
  // Solicita dados linha a linha (Chave: Valor) para evitar erro de JSON mal formado em fotos imperfeitas.
  const categories = Object.values(ExpenseCategory).join(", ");
  const prompt = `Analyze this receipt. List the data strictly in this format:
DATA: YYYY-MM-DD
VALOR: 0.00
CIDADE: City Name
CATEGORIA: One of [${categories}]
OBS: Short description

If data is missing, guess or leave blank. Do NOT use JSON.`;

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
                // responseMimeType: "text/plain", // Default
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
                ],
            },
        });

        const text = response.text;
        
        if (!text) throw new Error("IA retornou resposta vazia.");
        
        // Manual Parser (Robust Regex)
        const dateMatch = text.match(/DATA:\s*(\d{4}-\d{2}-\d{2})/i);
        const amountMatch = text.match(/VALOR:\s*(\d+[.,]\d{2})/i);
        const cityMatch = text.match(/CIDADE:\s*(.+)/i);
        const catMatch = text.match(/CATEGORIA:\s*(.+)/i);
        const obsMatch = text.match(/OBS:\s*(.+)/i);

        return {
            date: dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0],
            amount: amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0,
            city: cityMatch ? cityMatch[1].trim() : '',
            category: catMatch ? catMatch[1].trim() : 'Outros',
            notes: obsMatch ? obsMatch[1].trim() : ''
        };

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

const processTollPdf = async (base64Pdf: string): Promise<any[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key not found");

    const ai = new GoogleGenAI({ apiKey });
    
    let cleanBase64 = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf;
    cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');

    const prompt = `
    Analyze this PDF document (Toll/Parking Statement). 
    Extract ALL transactions listed in the table.
    Return ONLY a valid JSON Array of objects. Each object must have:
    - date (YYYY-MM-DD)
    - city (Name of the establishment or toll plaza)
    - amount (Number, use dot for decimal)
    - category (String: 'Pedágio' or 'Estacionamento'. Infer based on context, default to 'Pedágio')
    
    Response must start with [ and end with ]. No markdown.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { inlineData: { mimeType: "application/pdf", data: cleanBase64 } },
                    { text: prompt }
                ]
            },
            config: {
                // responseMimeType: "application/json", // Some models struggle with strict JSON mode on long PDFs, standard text with strict prompt is often safer
                 safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                ]
            }
        });

        const text = response.text;
        if (!text) return [];
        
        const jsonStr = cleanJsonString(text);
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("PDF Processing Error:", error);
        throw new Error("Falha ao processar PDF com IA.");
    }
};

export { processReceiptImage, processTollPdf };