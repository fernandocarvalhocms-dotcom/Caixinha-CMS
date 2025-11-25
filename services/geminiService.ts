
import { GoogleGenAI } from "@google/genai";
import { ExpenseCategory } from "../types";

const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Helper para limpar formatação Markdown que a IA adora colocar
const cleanResponseText = (text: string): string => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// Helper para tentar encontrar valores na força bruta (Regex) caso o JSON falhe
const extractFallbackData = (text: string) => {
  // Procura valor monetário (ex: 100,00 ou 100.00)
  const amountMatch = text.match(/[\d\.]+,?\d{2}/); 
  let amount = 0;
  if (amountMatch) {
      // Normaliza "1.234,56" para "1234.56"
      const cleanAmount = amountMatch[0].replace(/\./g, '').replace(',', '.');
      amount = parseFloat(cleanAmount);
  }

  // Procura data (ex: 2023-10-25 ou 25/10/2023)
  const dateMatchISO = text.match(/\d{4}-\d{2}-\d{2}/);
  const dateMatchBR = text.match(/\d{2}\/\d{2}\/\d{4}/);
  
  let date = new Date().toISOString().split('T')[0];
  
  if (dateMatchISO) {
      date = dateMatchISO[0];
  } else if (dateMatchBR) {
      const parts = dateMatchBR[0].split('/');
      date = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  return { amount, date };
};

export const processReceiptImage = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<any> => {
  if (!ai) throw new Error("API Key not found");

  // SAFETY: Remove prefixos se existirem, garantindo apenas o hash base64
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  const categories = Object.values(ExpenseCategory).join(", ");

  const prompt = `
  Analise este documento (nota fiscal/recibo).
  Responda APENAS um objeto JSON válido. Não use Markdown.
  
  Campos Obrigatórios:
  {
    "amount": (Número float. Ex: 10.50. Procure o valor TOTAL a pagar),
    "date": (String "YYYY-MM-DD". Se ilegível, use "${new Date().toISOString().split('T')[0]}"),
    "city": (String. Cidade do estabelecimento),
    "category": (String. Melhor match desta lista: [${categories}]),
    "notes": (String. Nome do estabelecimento e itens principais)
  }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: cleanBase64 } },
          { text: prompt },
        ],
      },
      // Configuração relaxada para evitar erros de schema rígido
      config: {
        temperature: 0.4, // Menos criatividade, mais precisão
      },
    });

    const rawText = response.text || "";
    console.log("Raw AI Response:", rawText);

    try {
        // Tentativa 1: Parse JSON direto
        const cleanedJson = cleanResponseText(rawText);
        // Busca o primeiro { e o último }
        const firstBrace = cleanedJson.indexOf('{');
        const lastBrace = cleanedJson.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1) throw new Error("JSON bounds not found");
        
        const finalJsonStr = cleanedJson.substring(firstBrace, lastBrace + 1);
        const data = JSON.parse(finalJsonStr);
        
        // Garante numérico
        if (typeof data.amount === 'string') {
            data.amount = parseFloat(data.amount.replace(',', '.'));
        }

        return data;

    } catch (parseError) {
        console.warn("Falha no JSON da IA, usando Fallback Regex", parseError);
        
        // Tentativa 2: Extração via Regex (Plano B)
        const fallback = extractFallbackData(rawText);
        
        return {
            amount: fallback.amount,
            date: fallback.date,
            city: "",
            category: "Refeição", // Default seguro
            notes: "Leitura parcial (Confirmar dados)"
        };
    }

  } catch (error) {
    console.error("Gemini Critical Error:", error);
    // Retorno nulo avisa a UI para pedir preenchimento manual
    return null;
  }
};

export const verifyFaceIdentity = async (referenceImageBase64: string, currentImageBase64: string): Promise<boolean> => {
    if (!ai) return false;
    
    // Limpeza básica
    const cleanRef = referenceImageBase64.includes(',') ? referenceImageBase64.split(',')[1] : referenceImageBase64;
    const cleanCurr = currentImageBase64.includes(',') ? currentImageBase64.split(',')[1] : currentImageBase64;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { text: "Reference photo:" },
                    { inlineData: { mimeType: "image/jpeg", data: cleanRef } },
                    { text: "Current login photo:" },
                    { inlineData: { mimeType: "image/jpeg", data: cleanCurr } },
                    { text: "Are these the same person? Return JSON: { \"match\": boolean }" }
                ]
            }
        });
        
        const text = cleanResponseText(response.text || "");
        const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
        return json.match === true;
    } catch (e) {
        console.error("Bio Error", e);
        return false;
    }
};
