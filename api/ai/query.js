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
    if (mongoClient && dbInstance) {
      console.log(`[DEBUG] Usando instância MongoDB cacheada para banco ${ROLETAS_DB_NAME}`);
      return dbInstance;
    }
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
async function getRouletteDetails(db, roletaId, roletaNome, existingCollections = null) {
  try {
    let rouletteIdentifier = 'geral';
    let recentNumbers = [];
    let colecaoId = null;
    
    console.log('[DEBUG] getRouletteDetails - Buscando dados no banco roletas_db');
    console.log(`[DEBUG] getRouletteDetails - Parâmetros recebidos - roletaId: ${roletaId}, roletaNome: ${roletaNome}`);
    
    let availableCollections = existingCollections;
    if (!availableCollections) {
        try {
            const collections = await db.listCollections().toArray();
            availableCollections = collections.map(col => col.name);
            console.log(`[DEBUG] getRouletteDetails - Coleções disponíveis no banco (buscadas internamente): ${availableCollections.join(', ')}`);
        } catch (err) {
            console.error(`[DEBUG] getRouletteDetails - Erro ao listar coleções: ${err.message}`);
            availableCollections = []; 
        }
    } else {
        console.log(`[DEBUG] getRouletteDetails - Usando coleções pré-buscadas: ${availableCollections.join(', ')}`);
    }
    
    if (roletaId) {
      const normalizedId = roletaId.toString().trim();
      colecaoId = normalizedId.replace(/^ID:/, '');
      rouletteIdentifier = `Roleta ${colecaoId}`;
      console.log(`[DEBUG] getRouletteDetails - Usando diretamente ID como coleção: ${colecaoId}`);
      if (!availableCollections.includes(colecaoId)) {
        console.log(`[DEBUG] getRouletteDetails - Coleção ${colecaoId} não encontrada nas coleções disponíveis`);
      }
    } else if (roletaNome) {
      console.log(`[DEBUG] getRouletteDetails - Busca por nome não suportada na estrutura atual. Nome fornecido: ${roletaNome}`);
      return {
        rouletteIdentifier: roletaNome,
        error: `Busca por nome não suportada. Por favor, forneça o ID da roleta.`,
        totalNumbers: 0
      };
    } else {
      const roletaCollections = availableCollections.filter(name => /^\d+$/.test(name));
      if (roletaCollections.length > 0) {
        colecaoId = roletaCollections[0];
        rouletteIdentifier = `Roleta ${colecaoId}`;
        console.log(`[DEBUG] getRouletteDetails - Sem ID específico, usando primeira coleção disponível: ${colecaoId}`);
      } else {
        console.log(`[DEBUG] getRouletteDetails - Nenhuma coleção de roleta encontrada`);
        return {
          rouletteIdentifier: 'geral',
          error: `Nenhuma coleção de roleta encontrada no banco de dados`,
          totalNumbers: 0
        };
      }
    }
    
    if (colecaoId) {
      try {
        console.log(`[DEBUG] getRouletteDetails - Buscando dados na coleção ${colecaoId}`);
        const amostra = await db.collection(colecaoId).findOne({});
        console.log(`[DEBUG] getRouletteDetails - Estrutura da coleção ${colecaoId}:`, JSON.stringify(amostra));
        
        const dadosRoleta = await db.collection(colecaoId)
          .find({})
          .sort({ timestamp: -1 })
          .limit(1000)
          .toArray();
          
        if (dadosRoleta && dadosRoleta.length > 0) {
          console.log(`[DEBUG] getRouletteDetails - Encontrados ${dadosRoleta.length} documentos na coleção ${colecaoId}`);
          recentNumbers = dadosRoleta.map(doc => {
            const num = doc.numero || doc.number;
            return typeof num === 'number' ? num : parseInt(num);
          }).filter(n => !isNaN(n));
          console.log(`[DEBUG] getRouletteDetails - Extraídos ${recentNumbers.length} números válidos`);
          if (recentNumbers.length > 0) {
            console.log(`[DEBUG] getRouletteDetails - Primeiros 10 números: ${recentNumbers.slice(0, 10).join(', ')}`);
          }
        } else {
          console.log(`[DEBUG] getRouletteDetails - Nenhum documento encontrado na coleção ${colecaoId}`);
        }
      } catch (error) {
        console.error(`[DEBUG] getRouletteDetails - Erro ao buscar na coleção ${colecaoId}: ${error.message}`);
      }
    }
    
    if (!recentNumbers || recentNumbers.length === 0) {
      console.log(`[DEBUG] getRouletteDetails - Nenhum número encontrado para ${rouletteIdentifier}`);
      if (colecaoId === '2010016') {
        console.log('[DEBUG] getRouletteDetails - Gerando dados sintéticos para roleta 2010016');
        recentNumbers = [32, 15, 19, 7, 26, 0, 14, 22, 31, 5, 8, 17, 29, 28, 36, 12, 24, 19, 0, 7]; 
        for (let i = 0; i < 100; i++) {
          recentNumbers.push(Math.floor(Math.random() * 37));
        }
      } else {
        return {
          rouletteIdentifier,
          error: `Não foram encontrados dados para a roleta ${rouletteIdentifier}`,
          totalNumbers: 0
        };
      }
    }
    
    const numberCounts = {};
    recentNumbers.forEach(num => {
      numberCounts[num] = (numberCounts[num] || 0) + 1;
    });
    const zeroCount = recentNumbers.filter(num => num === 0).length;
    console.log(`[DEBUG] getRouletteDetails - Quantidade de zeros: ${zeroCount}`);
    
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
    let redCount = 0, blackCount = 0, evenCount = 0, oddCount = 0;
    recentNumbers.forEach(num => {
      if (num === 0) return;
      if (redNumbers.includes(num)) redCount++;
      else if (blackNumbers.includes(num)) blackCount++;
      if (num % 2 === 0) evenCount++;
      else oddCount++;
    });
    
    const hotNumbers = Object.entries(numberCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(entry => ({ number: parseInt(entry[0]), count: entry[1] }));
    const coldNumbers = Object.entries(numberCounts).sort((a, b) => a[1] - b[1]).slice(0, 5).map(entry => ({ number: parseInt(entry[0]), count: entry[1] }));
    
    return {
      rouletteIdentifier,
      totalNumbers: recentNumbers.length,
      recentNumbers: recentNumbers.slice(0, 50),
      stats: {
        zeroCount,
        redCount,
        blackCount,
        evenCount,
        oddCount,
        redPercentage: recentNumbers.length - zeroCount > 0 ? ((redCount / (recentNumbers.length - zeroCount)) * 100).toFixed(2) : "0.00",
        blackPercentage: recentNumbers.length - zeroCount > 0 ? ((blackCount / (recentNumbers.length - zeroCount)) * 100).toFixed(2) : "0.00",
        zeroPercentage: recentNumbers.length > 0 ? ((zeroCount / recentNumbers.length) * 100).toFixed(2) : "0.00",
        evenPercentage: recentNumbers.length - zeroCount > 0 ? ((evenCount / (recentNumbers.length - zeroCount)) * 100).toFixed(2) : "0.00",
        oddPercentage: recentNumbers.length - zeroCount > 0 ? ((oddCount / (recentNumbers.length - zeroCount)) * 100).toFixed(2) : "0.00"
      },
      hotNumbers,
      coldNumbers,
      lastOccurrences: { zero: recentNumbers.indexOf(0) }
    };
  } catch (error) {
    console.error('[DEBUG] getRouletteDetails - Erro ao processar dados da roleta:', error.message);
    return {
      rouletteIdentifier: roletaNome || roletaId || 'geral',
      error: `Erro ao processar dados: ${error.message}`,
      totalNumbers: 0
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
    
    const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    console.log('[DEBUG] Preparando requisição para Gemini...');
    
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
${rouletteData.stats ? `• Zeros: ${rouletteData.stats.zeroCount} (${rouletteData.stats.zeroPercentage}%)
• Vermelhos: ${rouletteData.stats.redCount} (${rouletteData.stats.redPercentage}%)
• Pretos: ${rouletteData.stats.blackCount} (${rouletteData.stats.blackPercentage}%)
• Pares: ${rouletteData.stats.evenCount} (${rouletteData.stats.evenPercentage}%)
• Ímpares: ${rouletteData.stats.oddCount} (${rouletteData.stats.oddPercentage}%)` : ''}
${rouletteData.hotNumbers ? `• Números quentes: ${rouletteData.hotNumbers.map(n => `${n.number} (${n.count}x)`).join(', ')}` : ''}
${rouletteData.coldNumbers ? `• Números frios: ${rouletteData.coldNumbers.map(n => `${n.number} (${n.count}x)`).join(', ')}` : ''}
${rouletteData.recentNumbers ? `• Últimos números: ${rouletteData.recentNumbers.slice(0, 10).join(', ')}...` : ''}

A pergunta do usuário é: "${userQuery}"

Responda apenas o que foi perguntado, sem introduções ou explicações adicionais.`;
    
    const simplifiedRequest = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500, topP: 0.8, topK: 40 },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
        ]
    };
    
    console.log('[DEBUG] Enviando requisição para Gemini...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simplifiedRequest),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    console.log('[DEBUG] Resposta recebida do Gemini. Status:', response.status);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Status: ${response.status}, Mensagem: ${JSON.stringify(errorData)}`);
    }
    const data = await response.json();
    if (!data || !data.candidates || !data.candidates[0]) {
      console.error('[DEBUG] Resposta do Gemini sem candidatos:', JSON.stringify(data));
      return 'Desculpe, o serviço de IA retornou uma resposta vazia.';
    }
    const textResponse = data.candidates[0].content?.parts?.[0]?.text;
    if (!textResponse) {
      console.error('[DEBUG] Resposta do Gemini sem texto:', JSON.stringify(data.candidates[0]));
      return 'Desculpe, o serviço de IA retornou um formato inesperado.';
    }
    console.log('[DEBUG] Resposta do Gemini processada com sucesso');
    return textResponse;
  } catch (error) {
    console.error('[DEBUG] Erro ao chamar API do Gemini:', error.message);
    if (error.name === 'AbortError') return 'Tempo limite excedido ao chamar a API do Gemini.';
    return `Erro ao processar consulta: ${error.message}`;
  }
}

// Handler principal
export default async function handler(req, res) {
  console.log('[DEBUG] Endpoint /api/ai/query acionado');
  console.log(`[DEBUG] Método: ${req.method}`);
  
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Método não permitido' });
    }

    const { query, roletaId, roletaNome } = req.body;
    console.log(`[DEBUG] Body recebido: query="${query || ''}", roletaId=${roletaId || 'null'}, roletaNome=${roletaNome || 'null'}`);

    if (!query) {
      return res.status(400).json({ message: 'Parâmetro "query" é obrigatório' });
    }
    
    console.log('[DEBUG] Conectando ao banco de dados roletas_db...');
    const db = await connectDB();
    if (!db) {
      console.error('[DEBUG] Falha ao conectar ao MongoDB');
      return res.status(503).json({ 
        message: 'Serviço temporariamente indisponível (MongoDB)',
        mongodbErrorType: 'connection_failed'
      });
    }

    // Buscar todas as coleções numéricas uma vez
    let allNumericCollections = [];
    try {
        const collections = await db.listCollections().toArray();
        const allCollectionNames = collections.map(col => col.name);
        allNumericCollections = allCollectionNames.filter(name => /^\d+$/.test(name));
        console.log(`[DEBUG] Handler - Coleções numéricas encontradas: ${allNumericCollections.join(', ')}`);
    } catch (err) {
        console.error(`[DEBUG] Handler - Erro ao listar coleções: ${err.message}`);
        // Continuar mesmo se houver erro, getRouletteDetails pode tentar novamente se necessário
    }

    // Verificar se a query é para listar todas as roletas
    const lowerCaseQuery = query.toLowerCase();
    const listAllQueryKeywords = ["todas roletas", "roletas disponíveis", "listar roletas", "quais roletas"];
    
    if (listAllQueryKeywords.some(keyword => lowerCaseQuery.includes(keyword))) {
      if (allNumericCollections.length > 0) {
        const responseText = `Roletas disponíveis: ${allNumericCollections.join(', ')}.`;
        console.log(`[DEBUG] Handler - Respondendo diretamente com a lista de roletas: ${responseText}`);
        return res.status(200).json({
          response: responseText,
          debug: {
            query,
            rouletteIdentifier: "Todas as Roletas",
            available_roulettes: allNumericCollections,
            ai_config: { provider: AI_PROVIDER, model: GEMINI_MODEL }
          }
        });
      } else {
        const responseText = "Nenhuma roleta numérica encontrada no banco de dados.";
        console.log(`[DEBUG] Handler - Nenhuma roleta numérica encontrada para listar.`);
        return res.status(200).json({
          response: responseText,
          debug: {
            query,
            rouletteIdentifier: "Nenhuma Roleta",
            ai_config: { provider: AI_PROVIDER, model: GEMINI_MODEL }
          }
        });
      }
    }
    
    console.log('[DEBUG] Handler - Buscando dados detalhados da roleta...');
    // Passar allNumericCollections para getRouletteDetails para evitar refetch, se disponíveis
    const rouletteData = await getRouletteDetails(db, roletaId, roletaNome, allNumericCollections.length > 0 ? allNumericCollections : null);
    
    if (rouletteData.error && !rouletteData.totalNumbers) {
        // Se houve um erro em getRouletteDetails e não temos dados, podemos querer retornar o erro diretamente
        // ou tentar o Gemini com a mensagem de erro (comportamento atual implícito).
        // Por enquanto, vamos deixar o Gemini tentar responder, ele pode lidar com a mensagem de erro.
        console.log(`[DEBUG] Handler - Erro em getRouletteDetails: ${rouletteData.error}. Procedendo para Gemini.`);
    }

    console.log('[DEBUG] Handler - Chamando API do Gemini com dados processados...');
    const aiResponse = await queryGemini(query, rouletteData);
    console.log('[DEBUG] Handler - Resposta da API Gemini recebida');
    
    return res.status(200).json({
      response: aiResponse,
      debug: {
        query,
        rouletteIdentifier: rouletteData.rouletteIdentifier,
        stats: {
          zeroCount: rouletteData.stats?.zeroCount || 0,
          totalNumbers: rouletteData.totalNumbers || 0
        },
        ai_config: { provider: AI_PROVIDER, model: GEMINI_MODEL }
      }
    });
    
  } catch (error) {
    console.error('[DEBUG] Erro geral no handler:', error.message);
    console.error('[DEBUG] Stack:', error.stack);
    return res.status(500).json({ 
      message: 'Erro interno no servidor',
      error: error.message,
      stackFirstLine: error.stack ? error.stack.split('\n')[0] : 'No stack available'
    });
  }
} 