
import { GoogleGenAI, Type } from "@google/genai";
import { ExpenseCategory } from "../types";

const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

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
  if (!ai) throw new Error("API Key not found");

  const categories = Object.values(ExpenseCategory).join(", ");

  const prompt = `Analise este documento (imagem de nota fiscal/recibo).
  Extraia os dados em JSON puro, sem markdown.
  
  Extraia:
  1. Data (YYYY-MM-DD). Se não encontrar ou estiver ilegível, use a data de HOJE.
  2. Cidade. Se não encontrar, deixe vazio.
  3. Valor total (number). Se houver múltiplos valores, procure o "TOTAL".
  4. Categoria: Escolha a melhor opção entre: ${categories}.
  5. Descrição curta para observações.

  Retorne APENAS o JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            city: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING, enum: Object.values(ExpenseCategory) },
            notes: { type: Type.STRING },
          },
          required: ["date", "amount", "category"],
        },
      },
    });

    const text = response.text;
    if (!text) return null;
    
    try {
        const cleanedText = cleanJsonString(text);
        return JSON.parse(cleanedText);
    } catch (parseError) {
        console.error("Erro ao fazer parse do JSON:", text);
        // Fallback: try to parse without cleaning if cleaner failed logic
        return JSON.parse(text);
    }
  } catch (error) {
    console.error("Erro ao processar documento com Gemini:", error);
    throw error;
  }
};

const verifyFaceIdentity = async (referenceImageBase64: string, currentImageBase64: string): Promise<boolean> => {
  if (!ai) throw new Error("API Key not found");

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
          { inlineData: { mimeType: "image/jpeg", data: referenceImageBase64 } },
          { text: "Foto Atual:" },
          { inlineData: { mimeType: "image/jpeg", data: currentImageBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
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
