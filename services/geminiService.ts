
import { GoogleGenAI, Type } from "@google/genai";
import { ExpenseCategory } from "../types";

const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const processReceiptImage = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<any> => {
  if (!ai) throw new Error("API Key not found");

  const categories = Object.values(ExpenseCategory).join(", ");

  const prompt = `Analise este documento (imagem de nota fiscal/recibo).
  Tente extrair o máximo de informação possível, mesmo que a imagem esteja parcialmente desfocada.
  
  Extraia:
  1. Data (YYYY-MM-DD). Se não encontrar ou estiver ilegível, use a data de HOJE.
  2. Cidade. Se não encontrar, deixe vazio.
  3. Valor total (number). Se houver múltiplos valores, procure o "TOTAL".
  4. Categoria: Escolha a melhor opção entre: ${categories}.
  5. Descrição curta para observações.

  Retorne JSON válido.`;

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
    return JSON.parse(text);
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
  Considere iluminação e ângulo, mas foque na estrutura facial.
  
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

    const result = JSON.parse(response.text || '{"match": false}');
    return result.match;
  } catch (error) {
    console.error("Erro na verificação facial:", error);
    return false;
  }
};

export { processReceiptImage, verifyFaceIdentity };
