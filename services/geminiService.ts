
import { GoogleGenAI, Type } from "@google/genai";
import { ExpenseCategory } from "../types";

const cleanJsonString = (str: string): string => {
  // Remove markdown code blocks if present (```json ... ``` or just ``` ... ```)
  let cleaned = str.replace(/```json/g, '').replace(/```/g, '');
  // Find the first '{' and last '}' to ensure we only parse the object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return cleaned.trim();
};

const processReceiptImage = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<any> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found. Please check your environment configuration.");
  
  const ai = new GoogleGenAI({ apiKey });

  // SAFETY: Ensure base64Data doesn't contain the Data URI prefix
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  const categories = Object.values(ExpenseCategory).join(", ");

  const prompt = `Analise este documento (imagem de nota fiscal/recibo).
  O documento pode ser uma foto tirada de celular. Ignore fundos, dedos ou objetos ao redor. Foque apenas no texto do recibo.
  
  Extraia os dados em JSON puro, sem markdown.
  
  Extraia:
  1. Data (YYYY-MM-DD). Procure por datas de emissão. Se não encontrar, use a data de HOJE.
  2. Cidade. Se não encontrar, deixe vazio.
  3. Valor total (number). Se houver múltiplos valores, procure o "TOTAL" ou "A PAGAR".
  4. Categoria: Escolha a melhor opção entre: ${categories}.
  5. Descrição curta para observações (ex: Nome do estabelecimento).

  Retorne APENAS o JSON.`;

  // Retry logic for mobile network stability
  let lastError;
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
                // Safety settings are CRITICAL for mobile photos (hands, tables, etc often trigger false positives)
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
                ],
                responseSchema: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING },
                    city: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    category: { type: Type.STRING, enum: Object.values(ExpenseCategory) },
                    notes: { type: Type.STRING },
                },
                // No required fields to avoid validation errors on partial reads
                required: [], 
                },
            },
        });

        const text = response.text;
        
        if (!text) {
            throw new Error("Resposta vazia da IA");
        }
        
        try {
            const cleanedText = cleanJsonString(text);
            return JSON.parse(cleanedText);
        } catch (parseError) {
            console.warn("JSON Parse Error, attempting regex fallback:", text);
            // Fallback: Regex extraction if JSON fails
            const amountMatch = text.match(/(\d+[.,]\d{2})/);
            const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
            
            return {
                amount: amountMatch ? parseFloat(amountMatch[0].replace(',', '.')) : 0,
                date: dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0],
                category: 'Refeição', // Default
                notes: 'Extração manual (Falha no JSON)',
                city: ''
            };
        }
    } catch (error) {
        console.error(`Gemini API Attempt ${attempt} failed:`, error);
        lastError = error;
        // Wait 1s before retry if not last attempt
        if (attempt < 3) await new Promise(res => setTimeout(res, 1000));
    }
  }
  
  // If we got here, all attempts failed
  throw lastError || new Error("Falha ao processar imagem após 3 tentativas");
};

const verifyFaceIdentity = async (referenceImageBase64: string, currentImageBase64: string): Promise<boolean> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found. Please check your environment configuration.");
  
  const ai = new GoogleGenAI({ apiKey });

  const cleanRef = referenceImageBase64.includes(',') ? referenceImageBase64.split(',')[1] : referenceImageBase64;
  const cleanCurr = currentImageBase64.includes(',') ? currentImageBase64.split(',')[1] : currentImageBase64;

  const prompt = `Atue como um sistema de segurança biométrica.
  Você receberá duas imagens. 
  A primeira é a foto de referência (cadastro).
  A segunda é a foto tirada agora (login).
  
  Analise os traços faciais cuidadosamente. É a mesma pessoa?
  Retorne JSON: { "match": boolean }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: {
        parts: [
          { text: "Foto Referencia:" },
          { inlineData: { mimeType: "image/jpeg", data: cleanRef } },
          { text: "Foto Atual:" },
          { inlineData: { mimeType: "image/jpeg", data: cleanCurr } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ],
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            match: { type: Type.BOOLEAN }
          },
          required: ["match"]
        }
      }
    });

    const cleanedText = cleanJsonString(response.text || '{"match": false}');
    const result = JSON.parse(cleanedText);
    return result.match;
  } catch (error) {
    console.error("Erro na verificação facial:", error);
    return false;
  }
};

export { processReceiptImage, verifyFaceIdentity };
