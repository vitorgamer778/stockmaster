
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Unit, Tab } from "../types";

// Always use process.env.GEMINI_API_KEY and named parameter for initialization
const getAI = () => {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set in environment');
  return new GoogleGenAI({ apiKey: key });
};

export const extractProductsFromDocument = async (base64Data: string, mimeType: string, tabs: Tab[]): Promise<{code: string, name: string, categoryName: string}[]> => {
  const ai = getAI();
  
  // Criamos uma lista clara de categorias e suas regras para a IA
  const categoriesContext = tabs.map(t => `- ABA "${t.name}": ${t.instruction || 'Produtos variados'}`).join('\n');

  const prompt = `
    Aja como um especialista em inventário. Analise o documento (Nota Fiscal ou Lista) e extraia os produtos encontrados.
    
    CATEGORIAS DISPONÍVEIS:
    ${categoriesContext}

    REGRAS CRÍTICAS:
    1. Corrija nomes abreviados ou errados (Ex: "CERV SKOL LATA" -> "CERVEJA SKOL LATA").
    2. Coloque TODOS os nomes em CAIXA ALTA.
    3. Para cada produto, escolha a ABA que melhor se encaixa baseando-se nas instruções acima.
    4. Se não tiver certeza absoluta, use a categoria "BAZAR & OUTROS" ou a mais genérica.
    5. Retorne os dados seguindo o formato JSON especificado.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Data, mimeType } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        // Using responseSchema as recommended for reliable JSON outputs
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING, description: 'Código do produto se disponível' },
              name: { type: Type.STRING, description: 'Nome do produto corrigido em caixa alta' },
              categoryName: { type: Type.STRING, description: 'Nome exato da ABA da categoria' },
            },
            required: ["code", "name", "categoryName"],
            propertyOrdering: ["code", "name", "categoryName"]
          }
        }
      }
    });

    // Directly access .text property (getter)
    const text = response.text || "[]";
    const result = JSON.parse(text);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Erro IA:", error);
    throw new Error("A IA não conseguiu processar este arquivo. Tente um formato mais nítido.");
  }
};
