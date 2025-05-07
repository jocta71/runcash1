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
const ROLETAS_DB_NAME = process.env.ROLETAS_MONGODB_DB_NAME || 'roletas_db';

// Cache para conexão com o banco de dados
let mongoClient = null;
let dbInstance = null;

// Função para conectar ao MongoDB
async function connectDB() {
  try {
    // Verificar se já existe conexão para este banco
    if (mongoClient && dbInstance) {
      console.log(`[DEBUG] Usando instância MongoDB cacheada para banco ${ROLETAS_DB_NAME}`);
      return dbInstance;
    }

    // Se ainda não temos cliente MongoDB, criar um novo
    if (!mongoClient) {
      console.log('[DEBUG] Conectando ao MongoDB...');
      
      const mongoOptions = {
        connectTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 15000
      };
      
      mongoClient = new MongoClient(MONGODB_URI, mongoOptions);
      await mongoClient.connect();
      console.log('[DEBUG] Conectado ao MongoDB com sucesso');
    }
    
    // Obter instância do banco específico
    dbInstance = mongoClient.db(ROLETAS_DB_NAME);
    
    console.log(`[DEBUG] Usando banco de dados: ${ROLETAS_DB_NAME}`);
    return dbInstance;
  } catch (error) {
    console.error('[DEBUG] Erro ao conectar ao MongoDB:', error.message);
    console.error('[DEBUG] Stack:', error.stack);
    return null;
  }
}

// Função para obter dados detalhados de uma roleta específica
async function getRouletteDetails(db, roletaId, roletaNome) {
  try {
    let rouletteIdentifier = 'geral';
    let recentNumbers = [];
    let colecaoId = null;
    
    console.log('[DEBUG] Buscando dados no banco roletas_db');
    
    // Se temos ID da roleta, verificar se é numérico
    if (roletaId) {
      if (/^\d+$/.test(roletaId)) {
        colecaoId = roletaId;
        rouletteIdentifier = `ID:${roletaId}`;
      } else {
        // Tentar buscar na coleção de metadados
        try {
          const metadata = await db.collection('metadados').findOne({
            roleta_id: roletaId
          });
          
          if (metadata && metadata.colecao) {
            colecaoId = metadata.colecao;
            rouletteIdentifier = metadata.roleta_nome || `ID:${roletaId}`;
          }
        } catch (error) {
          console.error(`[DEBUG] Erro ao buscar metadados por ID: ${error.message}`);
        }
      }
      console.log(`[DEBUG] Filtrando por ID: ${roletaId}, coleção identificada: ${colecaoId || "nenhuma"}`);
    } 
    // Se temos nome, verificar se podemos encontrar o ID correspondente
    else if (roletaNome) {
      rouletteIdentifier = roletaNome;
      console.log(`[DEBUG] Filtrando por nome: ${roletaNome}`);
      
      try {
        // Verificar se existe um mapeamento na coleção metadados
        const metadata = await db.collection('metadados').findOne({
          roleta_nome: roletaNome
        });
        
        if (metadata && metadata.colecao) {
          colecaoId = metadata.colecao;
          console.log(`[DEBUG] Encontrado ID ${colecaoId} para roleta ${roletaNome} via metadados`);
        }
      } catch (error) {
        console.error(`[DEBUG] Erro ao buscar metadados por nome: ${error.message}`);
      }
    } else {
      console.log('[DEBUG] Sem filtro específico, tentando listar coleções disponíveis');
      
      // Se não temos ID nem nome, tentar listar todas as coleções disponíveis
      try {
        // Listar coleções que não são de sistema ou metadados
        const collections = await db.listCollections().toArray();
        const roletaCollections = collections.filter(col => 
          !col.name.startsWith('system.') && 
          !['metadados', 'estatisticas'].includes(col.name));
          
        if (roletaCollections.length > 0) {
          // Usar a primeira coleção como exemplo
          colecaoId = roletaCollections[0].name;
          console.log(`[DEBUG] Sem filtro específico, usando primeira coleção disponível: ${colecaoId}`);
          
          // Tentar obter nome da roleta da coleção de metadados
          try {
            const metadata = await db.collection('metadados').findOne({
              colecao: colecaoId
            });
            
            if (metadata && metadata.roleta_nome) {
              rouletteIdentifier = metadata.roleta_nome;
            } else {
              rouletteIdentifier = `Roleta ${colecaoId}`;
            }
          } catch (error) {
            rouletteIdentifier = `Roleta ${colecaoId}`;
          }
        }
      } catch (error) {
        console.error(`[DEBUG] Erro ao listar coleções: ${error.message}`);
      }
    }
    
    // Se encontramos uma coleção específica, buscar os dados
    if (colecaoId) {
      try {
        // Verificar se a coleção existe
        const collections = await db.listCollections({name: colecaoId}).toArray();
        
        if (collections.length > 0) {
          console.log(`[DEBUG] Buscando na coleção específica ${colecaoId}`);
          
          const dadosRoleta = await db.collection(colecaoId)
            .find({})
            .sort({ timestamp: -1 })
            .limit(1000)
            .project({ _id: 0, numero: 1, timestamp: 1 })
            .toArray();
            
          if (dadosRoleta && dadosRoleta.length > 0) {
            console.log(`[DEBUG] Encontrados ${dadosRoleta.length} números na coleção ${colecaoId}`);
            // Extrair apenas os números
            recentNumbers = dadosRoleta.map(doc => doc.numero);
          } else {
            console.log(`[DEBUG] Nenhum número encontrado na coleção ${colecaoId}`);
          }
        } else {
          console.log(`[DEBUG] Coleção ${colecaoId} não encontrada no banco de dados`);
        }
      } catch (error) {
        console.error(`[DEBUG] Erro ao buscar na coleção específica: ${error.message}`);
      }
    }
    
    // Se não encontramos números, retornar erro
    if (!recentNumbers || recentNumbers.length === 0) {
      console.log(`[DEBUG] Nenhum número encontrado para ${rouletteIdentifier}`);
      return {
        rouletteIdentifier,
        error: `Não foram encontrados dados para a roleta ${rouletteIdentifier}`
      };
    }
    
    // A partir daqui, temos os números na variável recentNumbers
    // Contar ocorrências de cada número
    const numberCounts = {};
    recentNumbers.forEach(num => {
      numberCounts[num] = (numberCounts[num] || 0) + 1;
    });
    
    // Contar zeros especificamente
    const zeroCount = recentNumbers.filter(num => num === 0).length;
    console.log(`[DEBUG] Quantidade de zeros: ${zeroCount}`);
    
    // Categorizar por cores (para roletas padrão)
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
    
    let redCount = 0;
    let blackCount = 0;
    let evenCount = 0;
    let oddCount = 0;
    
    recentNumbers.forEach(num => {
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
      totalNumbers: recentNumbers.length,
      recentNumbers: recentNumbers.slice(0, 50), // Apenas os 50 mais recentes
      stats: {
        zeroCount,
        redCount,
        blackCount,
        evenCount,
        oddCount,
        redPercentage: ((redCount / (recentNumbers.length - zeroCount)) * 100).toFixed(2),
        blackPercentage: ((blackCount / (recentNumbers.length - zeroCount)) * 100).toFixed(2),
        zeroPercentage: ((zeroCount / recentNumbers.length) * 100).toFixed(2),
        evenPercentage: ((evenCount / (recentNumbers.length - zeroCount)) * 100).toFixed(2),
        oddPercentage: ((oddCount / (recentNumbers.length - zeroCount)) * 100).toFixed(2)
      },
      hotNumbers,
      coldNumbers,
      lastOccurrences: {
        zero: recentNumbers.indexOf(0) // Posição do último zero (-1 se não houver)
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
    
    // Conectar ao MongoDB - apenas banco roletas_db
    console.log('[DEBUG] Conectando ao banco de dados roletas_db...');
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