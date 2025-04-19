import axios from 'axios';
import { RouletteData, GeminiResponse } from '../../types/ai-data';

export class GeminiService {
  /**
   * Envia uma consulta para a API Gemini com dados das roletas
   * @param query Pergunta do usuário
   * @param rouletteData Dados das roletas para análise
   * @returns Resposta processada da API Gemini
   */
  static async queryRoulettesAnalysis(query: string, rouletteData: RouletteData): Promise<string> {
    try {
      // Obter a chave da API
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY');
      
      if (!apiKey) {
        throw new Error('Chave da API Gemini não encontrada');
      }
      
      // Configurar a requisição para a API Gemini
      const model = 'gemini-2.0-flash';
      const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
      
      const response = await axios.post<GeminiResponse>(
        apiUrl,
        {
          contents: [
            {
              role: "user",
              parts: [
                { 
                  text: `Instruções do sistema:
                  Você é um assistente especializado em análise de dados de roletas de cassino.
                  
                  DIRETRIZES PARA SUAS RESPOSTAS:
                  1. Seja EXTREMAMENTE DIRETO E OBJETIVO - vá direto ao ponto.
                  2. Use frases curtas e precisas.
                  3. Organize visualmente suas respostas com:
                     - Marcadores (•) para listas
                     - Texto em **negrito** para destacar números e informações importantes
                     - Tabelas simples quando necessário comparar dados
                     - Espaçamento adequado para melhor legibilidade
                  4. Forneça APENAS as informações solicitadas, sem explicações desnecessárias.
                  5. Se a resposta tiver estatísticas, apresente-as de forma estruturada e visualmente clara.
                  6. Sempre responda em português brasileiro.
                  7. Nunca mencione marcas de IA ou similar nas suas respostas.
                  8. Você é a IA RunCash, especializada em análise de roletas.
                  
                  Dados da roleta: ${JSON.stringify(rouletteData)}
                  
                  Consulta do usuário: ${query}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
            topP: 0.95,
            topK: 40
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000 // Timeout de 30 segundos
        }
      );
      
      // Extrair e retornar a resposta da API
      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Erro ao consultar API Gemini:', error);
      return 'Desculpe, ocorreu um erro ao processar sua consulta. Por favor, tente novamente mais tarde.';
    }
  }

  /**
   * Carrega dados de exemplo para testes quando os dados reais não estão disponíveis
   * @returns Dados de roleta de exemplo para testes
   */
  static getExampleRouletteData(): RouletteData {
    return {
      numbers: {
        recent: [12, 35, 0, 26, 3, 15, 4, 0, 32, 15],
        raw: [12, 35, 0, 26, 3, 15, 4, 0, 32, 15, 7, 19, 23, 8, 11, 29, 16, 0, 33, 22],
        redCount: 45,
        blackCount: 42,
        greenCount: 3,
        redPercentage: 50.0,
        blackPercentage: 46.67,
        greenPercentage: 3.33,
        evenCount: 38,
        oddCount: 49,
        evenPercentage: 43.68,
        oddPercentage: 56.32,
        dozenCounts: [15, 18, 12],
        dozenPercentages: [33.33, 40.0, 26.67],
        hotNumbers: [32, 15, 0, 26],
        coldNumbers: [6, 13, 33, 1]
      },
      trends: [
        { type: 'color', value: 'red', count: 3 },
        { type: 'parity', value: 'odd', count: 5 },
        { type: 'dozen', value: '2nd', count: 4 }
      ],
      roletas: [
        { id: 'roulette1', name: 'Roleta Brasileira', online: true },
        { id: 'roulette2', name: 'Roleta Européia', online: true },
        { id: 'roulette3', name: 'Roleta Americana', online: false }
      ],
      numerosPorRoleta: {
        'Roleta Brasileira': [12, 35, 0, 26, 3, 15, 4, 0, 32, 15],
        'Roleta Européia': [7, 11, 23, 36, 0, 14, 31, 9, 22, 18],
        'Roleta Americana': [0, 26, 3, 15, 32, 5, 22, 16, 0, 33]
      }
    };
  }
}

export default GeminiService; 