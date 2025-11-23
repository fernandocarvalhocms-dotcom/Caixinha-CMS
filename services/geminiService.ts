import { GoogleGenAI, Type } from "@google/genai";
import { ExpenseCategory } from "../types";

const processReceiptImage = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<any> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey });

  const categories = Object.values(ExpenseCategory).join(", ");

  const prompt = `Analise este documento (pode ser imagem, PDF, XML ou texto) de nota fiscal, recibo ou comprovante.
  Extraia as seguintes informações:
  1. Data da despesa (formato YYYY-MM-DD). Se não encontrar, use a data de hoje.
  2. Cidade onde ocorreu.
  3. Valor total em Reais (apenas número).
  4. Categoria da despesa. Escolha OBRIGATORIAMENTE uma destas: ${categories}. Se não tiver certeza, escolha a mais próxima.
  5. Uma breve descrição para o campo observações baseada nos itens.

  Retorne apenas JSON.`;

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

export { processReceiptImage };