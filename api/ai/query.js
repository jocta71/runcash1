/**
 * Versão completa com processamento de dados específicos de roleta
 */

const { MongoClient } = require('mongodb');

// Configurações
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Variável global para cache da conexão do MongoDB
let dbInstance = null;

// Função para conectar ao MongoDB
async function connectDB() {
  try {
    if (dbInstance) {
      console.log('[DEBUG] Usando instância MongoDB cacheada');
      return dbInstance;
    }

    console.log('[DEBUG] Conectando ao MongoDB...');
    
    const mongoOptions = {
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 15000
    };
    
    const client = new MongoClient(MONGODB_URI, mongoOptions);
    await client.connect();
    
    console.log('[DEBUG] Conectado ao MongoDB com sucesso');
    const db = client.db(MONGODB_DB_NAME);
    dbInstance = db;
    return db;
  } catch (error) {
    console.error('[DEBUG] Erro ao conectar ao MongoDB:', error.message);
    console.error('[DEBUG] Stack:', error.stack);
    return null;
  }
}

// Função para obter dados detalhados de uma roleta específica
async function getRouletteDetails(db, roletaId, roletaNome) {
  try {
    let filter = {};
    let rouletteIdentifier = 'geral';
    
    // Determinar o campo correto para filtrar por nome da roleta
    const sampleDoc = await db.collection('roleta_numeros').findOne();
    const roletaNomeField = sampleDoc?.roleta_nome ? 'roleta_nome' : 
                           (sampleDoc?.rouletteName ? 'rouletteName' : 'nome');
    const roletaIdField = sampleDoc?.roleta_id ? 'roleta_id' : 'roletaId';
    const numeroField = sampleDoc?.numero ? 'numero' : 'number';
    
    console.log(`[DEBUG] Campos identificados: ${roletaNomeField}, ${roletaIdField}, ${numeroField}`);
    
    // Aplicar filtro baseado em ID ou nome da roleta
    if (roletaId) {
      filter[roletaIdField] = roletaId;
      rouletteIdentifier = `ID:${roletaId}`;
      console.log(`[DEBUG] Filtrando por ID: ${roletaId}`);
    } else if (roletaNome) {
      filter[roletaNomeField] = roletaNome;
      rouletteIdentifier = roletaNome;
      console.log(`[DEBUG] Filtrando por nome: ${roletaNome}`);
    } else {
      console.log('[DEBUG] Sem filtro específico, analisando todas as roletas');
    }
    
    // Buscar os últimos 1000 números da roleta
    const roletaNumeros = db.collection('roleta_numeros');
    const recentNumbers = await roletaNumeros
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();
    
    console.log(`[DEBUG] Encontrados ${recentNumbers.length} resultados recentes para ${rouletteIdentifier}`);
    
    if (recentNumbers.length === 0) {
      return {
        rouletteIdentifier,
        error: `Não foram encontrados dados para a roleta ${rouletteIdentifier}`
      };
    }
    
    // Processar os números para análise
    const numbers = recentNumbers.map(doc => doc[numeroField]);
    
    // Contar ocorrências de cada número
    const numberCounts = {};
    numbers.forEach(num => {
      numberCounts[num] = (numberCounts[num] || 0) + 1;
    });
    
    // Contar zeros especificamente
    const zeroCount = numbers.filter(num => num === 0).length;
    console.log(`[DEBUG] Quantidade de zeros: ${zeroCount}`);
    
    // Categorizar por cores (para roletas padrão)
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
    
    let redCount = 0;
    let blackCount = 0;
    let evenCount = 0;
    let oddCount = 0;
    
    numbers.forEach(num => {
      if (num === 0) return; // Zero não conta para estas estatísticas
      
      if (redNumbers.includes(num)) redCount++;
      else if (blackNumbers.includes(num)) blackCount++;
      
      if (num % 2 === 0) evenCount++;
      else oddCount++;
    });
    
    // Calcular os 5 números mais e menos frequentes
    const hotNumbers = Object.entries(numberCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => ({ number: parseInt(entry[0]), count: entry[1] }));
    
    const coldNumbers = Object.entries(numberCounts)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5)
      .map(entry => ({ number: parseInt(entry[0]), count: entry[1] }));
    
    // Estruturar os dados de retorno
    return {
      rouletteIdentifier,
      totalNumbers: numbers.length,
      recentNumbers: numbers.slice(0, 50), // Apenas os 50 mais recentes
      stats: {
        zeroCount,
        redCount,
        blackCount,
        evenCount,
        oddCount,
        redPercentage: ((redCount / (numbers.length - zeroCount)) * 100).toFixed(2),
        blackPercentage: ((blackCount / (numbers.length - zeroCount)) * 100).toFixed(2),
        zeroPercentage: ((zeroCount / numbers.length) * 100).toFixed(2),
        evenPercentage: ((evenCount / (numbers.length - zeroCount)) * 100).toFixed(2),
        oddPercentage: ((oddCount / (numbers.length - zeroCount)) * 100).toFixed(2)
      },
      hotNumbers,
      coldNumbers,
      lastOccurrences: {
        zero: numbers.indexOf(0) // Posição do último zero (-1 se não houver)
      }
    };
    
  } catch (error) {
    console.error('[DEBUG] Erro ao processar dados da roleta:', error.message);
    return {
      rouletteIdentifier: roletaNome || roletaId || 'geral',
      error: `Erro ao processar dados: ${error.message}`
    };
  }
}

// Função para chamar a API do Gemini usando fetch
async function queryGemini(userQuery, rouletteData) {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('[DEBUG] Chave da API Gemini não configurada');
    }
    
    console.log('[DEBUG] Iniciando consulta ao Gemini...');
    console.log(`[DEBUG] Modelo: ${GEMINI_MODEL}`);
    
    // URL completa com a chave API
    const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    
    console.log('[DEBUG] Preparando requisição para Gemini...');
    
    // Prompt melhorado e mais direto
    const prompt = `Você é um assistente especializado em análise de roleta de cassino.

Instruções:
1. Responda em português, de forma DIRETA e OBJETIVA.
2. Nunca diga que não tem informações quando os dados estão disponíveis abaixo.
3. Se perguntarem sobre zeros, informe o número exato de zeros.
4. Se perguntarem sobre tendências, use apenas os dados fornecidos.
5. Não inclua explicações desnecessárias ou introduções.
6. Não se desculpe ou faça ressalvas - seja assertivo.

Dados da roleta ${rouletteData.rouletteIdentifier}:
• Total de resultados analisados: ${rouletteData.totalNumbers || 0}
• Total de ZEROS: ${rouletteData.stats?.zeroCount || 0} (${rouletteData.stats?.zeroPercentage || "0"}%)
• Últimos números: ${(rouletteData.recentNumbers || []).slice(0,20).join(', ')}
• Números mais frequentes: ${(rouletteData.hotNumbers || []).map(n => n.number).join(', ')}
• Números menos frequentes: ${(rouletteData.coldNumbers || []).map(n => n.number).join(', ')}
• Proporção vermelho/preto: ${rouletteData.stats?.redCount || 0}/${rouletteData.stats?.blackCount || 0}
• Proporção par/ímpar: ${rouletteData.stats?.evenCount || 0}/${rouletteData.stats?.oddCount || 0}

A pergunta do usuário é: "${userQuery}"

Responda apenas o que foi perguntado, sem introduções ou explicações adicionais.`;
    
    // Criar uma requisição para o Gemini
    const simplifiedRequest = {
        contents: [
          {
            role: "user",
          parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
        temperature: 0.2,
          maxOutputTokens: 500,
        topP: 0.8,
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
    };
    
    // Log para debug
    console.log('[DEBUG] Enviando requisição para Gemini...');
    
    // Fazer a requisição usando fetch nativo
    console.log('[DEBUG] Aguardando resposta do Gemini...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 segundos timeout
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(simplifiedRequest),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Verificar o status HTTP
    console.log('[DEBUG] Resposta recebida do Gemini. Status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Status: ${response.status}, Mensagem: ${JSON.stringify(errorData)}`);
    }
    
    // Obter o JSON da resposta
    const data = await response.json();
    
    if (!data || !data.candidates || !data.candidates[0]) {
      console.error('[DEBUG] Resposta do Gemini sem candidatos:', JSON.stringify(data));
      return 'Desculpe, o serviço de IA retornou uma resposta vazia.';
    }
    
    // Extrair o texto
    const textResponse = data.candidates[0].content?.parts?.[0]?.text;
    if (!textResponse) {
      console.error('[DEBUG] Resposta do Gemini sem texto:', JSON.stringify(data.candidates[0]));
      return 'Desculpe, o serviço de IA retornou um formato inesperado.';
    }
    
    console.log('[DEBUG] Resposta do Gemini processada com sucesso');
    return textResponse;

  } catch (error) {
    console.error('[DEBUG] Erro ao chamar API do Gemini:', error.message);
    
    // Tratar erro de timeout
    if (error.name === 'AbortError') {
      return 'Tempo limite excedido ao chamar a API do Gemini.';
    }
    
    // Erro genérico
    return `Erro ao processar consulta: ${error.message}`;
  }
}

// Handler principal
export default async function handler(req, res) {
  console.log('[DEBUG] Endpoint /api/ai/query acionado');
  console.log(`[DEBUG] Método: ${req.method}`);
  
  try {
    // Verificar método HTTP
  if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Método não permitido' });
  }

    // Extrair dados do body
  const { query, roletaId, roletaNome } = req.body;
    console.log(`[DEBUG] Body recebido: query="${query || ''}", roletaId=${roletaId || 'null'}, roletaNome=${roletaNome || 'null'}`);

  if (!query) {
      return res.status(400).json({ message: 'Parâmetro "query" é obrigatório' });
    }
    
    // Conectar ao MongoDB
    const db = await connectDB();
    if (!db) {
      console.error('[DEBUG] Falha ao conectar ao MongoDB');
      return res.status(503).json({ 
        message: 'Serviço temporariamente indisponível (MongoDB)',
        mongodbErrorType: 'connection_failed'
      });
    }
    
    // Obter dados detalhados da roleta específica
    console.log('[DEBUG] Buscando dados detalhados da roleta...');
    const rouletteData = await getRouletteDetails(db, roletaId, roletaNome);
    
    // Agora, vamos chamar a API do Gemini com os dados de roleta processados
    console.log('[DEBUG] Chamando API do Gemini com dados processados...');
    
    try {
      const aiResponse = await queryGemini(query, rouletteData);
      console.log('[DEBUG] Resposta da API recebida');
      
      // Retornar resposta bem-sucedida
      return res.status(200).json({
        response: aiResponse,
        debug: {
          query,
          rouletteIdentifier: rouletteData.rouletteIdentifier,
          stats: {
            zeroCount: rouletteData.stats?.zeroCount || 0,
            totalNumbers: rouletteData.totalNumbers || 0
          },
          ai_config: {
            provider: AI_PROVIDER,
            model: GEMINI_MODEL
          }
        }
      });
      
    } catch (aiError) {
      console.error('[DEBUG] Erro ao processar consulta de IA:', aiError);
      return res.status(502).json({
        message: 'Erro ao processar consulta com o provedor de IA',
        error: aiError.message
      });
    }
    
  } catch (error) {
    // Registrar erro detalhado
    console.error('[DEBUG] Erro geral no handler:', error.message);
    console.error('[DEBUG] Stack:', error.stack);
    
    // Responder com erro detalhado
    return res.status(500).json({ 
      message: 'Erro interno no servidor',
      error: error.message,
      stackFirstLine: error.stack ? error.stack.split('\n')[0] : 'No stack available'
    });
  }
} 