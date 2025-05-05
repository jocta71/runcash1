/**
 * Endpoint para processamento de consultas de IA usando OpenAI, DeepSeek ou Gemini
 * 
 * Este serviço conecta a interface do chat com modelos de IA
 * para fornecer análises inteligentes sobre dados de roletas.
 */

const axios = require('axios');
const { MongoClient } = require('mongodb');

// Configuração do provedor de IA
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'; // Valores: 'openai', 'deepseek' ou 'gemini'

// Configuração do serviço OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ORG_ID = process.env.OPENAI_ORG_ID; // ID da organização (opcional)
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'; // Modelo configurável via env ou padrão gpt-4o
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Configuração do serviço DeepSeek
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'; // Modelo DeepSeek padrão
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Configuração do serviço Gemini (Google)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'; // Modelo Gemini padrão
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`;

// Verifica se as chaves de API estão configuradas
if (AI_PROVIDER === 'openai') {
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY não configurada no ambiente. A IA não funcionará corretamente.');
  } else {
    console.log('✅ OPENAI_API_KEY configurada corretamente');
    console.log(`ℹ️ Usando modelo OpenAI: ${OPENAI_MODEL}`);
    if (OPENAI_ORG_ID) {
      console.log('✅ OPENAI_ORG_ID configurado corretamente');
    } else {
      console.log('ℹ️ OPENAI_ORG_ID não configurado. Usando conta padrão do usuário da API.');
    }
  }
} else if (AI_PROVIDER === 'deepseek') {
  if (!DEEPSEEK_API_KEY) {
    console.warn('⚠️ DEEPSEEK_API_KEY não configurada no ambiente. A IA não funcionará corretamente.');
  } else {
    console.log('✅ DEEPSEEK_API_KEY configurada corretamente');
    console.log(`ℹ️ Usando modelo DeepSeek: ${DEEPSEEK_MODEL}`);
  }
} else if (AI_PROVIDER === 'gemini') {
  if (!GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY não configurada no ambiente. A IA não funcionará corretamente.');
  } else {
    console.log('✅ GEMINI_API_KEY configurada corretamente');
    console.log(`ℹ️ Usando modelo Gemini: ${GEMINI_MODEL}`);
  }
} else {
  console.warn(`⚠️ Provedor de IA desconhecido: ${AI_PROVIDER}. Usando OpenAI como fallback.`);
}

/**
 * Processa uma consulta usando a API do provedor selecionado
 */
async function processQuery(query, rouletteData) {
  try {
    // Selecionar o provedor de IA baseado na configuração
    if (AI_PROVIDER === 'deepseek' && DEEPSEEK_API_KEY) {
      return await processDeepSeekQuery(query, rouletteData);
    } else if (AI_PROVIDER === 'gemini' && GEMINI_API_KEY) {
      return await processGeminiQuery(query, rouletteData);
    } else {
      return await processOpenAIQuery(query, rouletteData);
    }
  } catch (error) {
    console.error(`❌ Erro ao processar consulta de IA: ${error.message}`);
    throw error;
  }
}

/**
 * Processa uma consulta usando a API da OpenAI
 */
async function processOpenAIQuery(query, rouletteData) {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('Chave de API da OpenAI não configurada');
    }

    // Configuração dos cabeçalhos para autenticação
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    };

    // Adiciona o cabeçalho da organização se estiver configurado
    if (OPENAI_ORG_ID) {
      headers['OpenAI-Organization'] = OPENAI_ORG_ID;
    }

    // Log para depuração (removendo a chave de API para segurança)
    console.log(`🔄 Iniciando consulta à OpenAI usando modelo: ${OPENAI_MODEL}`);
    
    // Validação adicional dos dados
    if (!rouletteData || typeof rouletteData !== 'object') {
      console.warn('⚠️ Dados de roleta inválidos ou ausentes');
      rouletteData = { nota: "Dados não disponíveis para análise" };
    }

    // Configuração da chamada para a API da OpenAI
    const openaiResponse = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em análise de dados de roletas de cassino.
            Sua função é analisar padrões, identificar tendências e fornecer insights estatísticos.
            Use uma linguagem amigável e clara, explicando conceitos estatísticos de forma acessível.
            Responda em português brasileiro. Baseie suas respostas nos dados fornecidos.
            IMPORTANTE: Nunca mencione a marca OpenAI, GPT ou similar nas suas respostas.
            Você é a IA RunCash, especializada em análise de roletas.`
          },
          {
            role: 'user',
            content: `Dados da roleta: ${JSON.stringify(rouletteData)}
            
            Consulta do usuário: ${query}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      },
      { headers, timeout: 30000 } // Timeout de 30 segundos para evitar esperas longas
    );

    console.log(`✅ Resposta da OpenAI recebida com sucesso - ${openaiResponse.data.usage?.total_tokens || 'N/A'} tokens usados`);
    return openaiResponse.data.choices[0].message.content;
  } catch (error) {
    console.error('❌ Erro ao processar consulta via OpenAI:', error.message);
    
    if (error.response) {
      console.error(`Detalhes do erro da OpenAI: Status ${error.response.status}`);
      
      // Tratamento específico para erros comuns da OpenAI API
      switch (error.response.status) {
        case 401:
          throw new Error('Falha na autenticação com a API da OpenAI. Verifique a chave API.');
        case 403:
          throw new Error('Acesso negado à API da OpenAI. Verifique permissões da chave e organização.');
        case 429:
          throw new Error('Limite de requisições excedido na API da OpenAI. Tente novamente mais tarde.');
        case 500:
        case 503:
          throw new Error('Serviços da OpenAI estão indisponíveis no momento. Tente novamente mais tarde.');
        default:
          console.error('Corpo da resposta de erro:', JSON.stringify(error.response.data));
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('A conexão com a OpenAI expirou. Verifique sua conexão de internet ou tente novamente.');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Não foi possível conectar ao servidor da OpenAI. Verifique sua conexão de internet.');
    }
    
    throw new Error('Falha ao processar sua consulta. Por favor, tente novamente.');
  }
}

/**
 * Processa uma consulta usando a API do DeepSeek
 */
async function processDeepSeekQuery(query, rouletteData) {
  try {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('Chave de API do DeepSeek não configurada');
    }

    // Configuração dos cabeçalhos para autenticação
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    };

    // Log para depuração
    console.log(`🔄 Iniciando consulta ao DeepSeek usando modelo: ${DEEPSEEK_MODEL}`);
    
    // Validação adicional dos dados
    if (!rouletteData || typeof rouletteData !== 'object') {
      console.warn('⚠️ Dados de roleta inválidos ou ausentes');
      rouletteData = { nota: "Dados não disponíveis para análise" };
    }

    // Configuração da chamada para a API do DeepSeek
    const deepseekResponse = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em análise de dados de roletas de cassino.
            Sua função é analisar padrões, identificar tendências e fornecer insights estatísticos.
            Use uma linguagem amigável e clara, explicando conceitos estatísticos de forma acessível.
            Responda em português brasileiro. Baseie suas respostas nos dados fornecidos.
            IMPORTANTE: Nunca mencione marcas de IA ou similar nas suas respostas.
            Você é a IA RunCash, especializada em análise de roletas.`
          },
          {
            role: 'user',
            content: `Dados da roleta: ${JSON.stringify(rouletteData)}
            
            Consulta do usuário: ${query}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      },
      { headers, timeout: 30000 } // Timeout de 30 segundos para evitar esperas longas
    );

    console.log(`✅ Resposta do DeepSeek recebida com sucesso - ${deepseekResponse.data.usage?.total_tokens || 'N/A'} tokens usados`);
    return deepseekResponse.data.choices[0].message.content;
  } catch (error) {
    console.error('❌ Erro ao processar consulta via DeepSeek:', error.message);
    
    if (error.response) {
      console.error(`Detalhes do erro do DeepSeek: Status ${error.response.status}`);
      
      // Tratamento específico para erros comuns da API
      switch (error.response.status) {
        case 401:
          throw new Error('Falha na autenticação com a API do DeepSeek. Verifique a chave API.');
        case 403:
          throw new Error('Acesso negado à API do DeepSeek. Verifique permissões da chave.');
        case 429:
          throw new Error('Limite de requisições excedido na API do DeepSeek. Tente novamente mais tarde.');
        case 500:
        case 503:
          throw new Error('Serviços do DeepSeek estão indisponíveis no momento. Tente novamente mais tarde.');
        default:
          console.error('Corpo da resposta de erro:', JSON.stringify(error.response.data));
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('A conexão com o DeepSeek expirou. Verifique sua conexão de internet ou tente novamente.');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Não foi possível conectar ao servidor do DeepSeek. Verifique sua conexão de internet.');
    }
    
    throw new Error('Falha ao processar sua consulta. Por favor, tente novamente.');
  }
}

/**
 * Processa uma consulta usando a API do Gemini (Google)
 */
async function processGeminiQuery(query, rouletteData) {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Chave de API do Gemini não configurada');
    }

    // Log para depuração
    console.log(`🔄 Iniciando consulta ao Gemini usando modelo: ${GEMINI_MODEL}`);
    
    // Validação adicional dos dados
    if (!rouletteData || typeof rouletteData !== 'object') {
      console.warn('⚠️ Dados de roleta inválidos ou ausentes');
      rouletteData = { nota: "Dados não disponíveis para análise" };
    }

    // A API do Gemini tem um formato diferente das outras
    const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    
    // Configuração da chamada para a API do Gemini
    const geminiResponse = await axios.post(
      apiUrl,
      {
        contents: [
          {
            role: "user",
            parts: [
              { 
                text: `Instruções do sistema:
Você é a IA RunCash, uma assistente especializada em análise ESTATÍSTICA de dados históricos de roletas de cassino.

Sua função é:
-interagir com o usuario de forma simples e direta.
- Ser um senior que ler arquivos de probabilidades de roleta, estudos matematicos, estatisticas e etc.
- Analisar padrões nos dados fornecidos (frequência de números/cores/dúzias/colunas, sequências, números quentes/frios recentes).
- Calcular e apresentar estatísticas e probabilidades baseadas nos dados históricos.

Comunicação:
- Use uma linguagem simple e direta.
- Explique conceitos estatísticos de forma simples.
- Responda sempre em português brasileiro.
- Mensagem organizada com um desing agradavel e simples.

IMPORTANTE - Segurança e Jogo Responsável:
- Baseie TODAS as respostas EXCLUSIVAMENTE nos dados fornecidos.
- Forneça APENAS análises estatísticas de dados históricos.
- NUNCA forneça conselhos sobre como apostar, estratégias de jogo ou recomendações financeiras.
- NUNCA faça previsões sobre resultados futuros. Deixe claro que resultados de roleta são aleatórios.
- NUNCA garanta ou sugira qualquer tipo de ganho.
- Mantenha a análise objetiva e estritamente baseada em dados passados e probabilidades matemáticas.
- Nunca mencione outras marcas de IA. Você é a IA RunCash.

--- DADOS DA ROLETA ---
${JSON.stringify(rouletteData)} 
--- FIM DOS DADOS ---

--- CONSULTA DO USUÁRIO ---
${query}`
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
        timeout: 30000 // Timeout de 30 segundos para evitar esperas longas
      }
    );

    // Extrair a resposta do Gemini
    const responseText = geminiResponse.data.candidates[0].content.parts[0].text;
    
    console.log(`✅ Resposta do Gemini recebida com sucesso`);
    return responseText;
  } catch (error) {
    console.error('❌ Erro ao processar consulta via Gemini:', error.message);
    
    if (error.response) {
      console.error(`Detalhes do erro do Gemini: Status ${error.response.status}`);
      console.error('Corpo da resposta de erro:', JSON.stringify(error.response.data));
      
      // Tratamento específico para erros comuns da API
      switch (error.response.status) {
        case 400:
          console.error('Detalhes:', JSON.stringify(error.response.data));
          throw new Error('Requisição inválida à API do Gemini. Verifique o formato dos dados.');
        case 401:
          throw new Error('Falha na autenticação com a API do Gemini. Verifique a chave API.');
        case 403:
          throw new Error('Acesso negado à API do Gemini. Verifique permissões da chave.');
        case 404:
          throw new Error(`Modelo "${GEMINI_MODEL}" não encontrado ou não suportado pela API do Gemini. Verifique o nome do modelo.`);
        case 429:
          throw new Error('Limite de requisições excedido na API do Gemini. Tente novamente mais tarde.');
        case 500:
        case 503:
          throw new Error('Serviços do Gemini estão indisponíveis no momento. Tente novamente mais tarde.');
        default:
          console.error('Corpo da resposta de erro:', JSON.stringify(error.response.data));
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('A conexão com o Gemini expirou. Verifique sua conexão de internet ou tente novamente.');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Não foi possível conectar ao servidor do Gemini. Verifique sua conexão de internet.');
    }
    
    throw new Error('Falha ao processar sua consulta. Por favor, tente novamente.');
  }
}

let dbInstance = null;

// Conectar ao MongoDB
async function connectDB() {
  // Usar a mesma URI do MongoDB que o sistema já usa
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';
  
  console.log('🔄 Conectando ao MongoDB para obter dados de roleta...');
  console.log(`🔶 URI do MongoDB: ${MONGODB_URI.replace(/:[^:]*@/, ':****@')}`);
  console.log(`🔶 Banco de dados: ${MONGODB_DB_NAME}`);
  
  // Corrigir: Adicionar opções explícitas de conexão para evitar problemas de timeout
  const mongoOptions = {
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 15000,
    useNewUrlParser: true,
    useUnifiedTopology: true
  };
  
  console.log('🔄 Tentando conectar com opções:', JSON.stringify(mongoOptions));
  
  // Conectar ao MongoDB com tratamento de erro aprimorado
  const client = new MongoClient(MONGODB_URI, mongoOptions);
  
  try {
    await client.connect();
    console.log('✅ Conectado ao MongoDB com sucesso!');
    
    const db = client.db(MONGODB_DB_NAME);
    
    // Primeiro, vamos verificar quais coleções existem
    const colecoes = await db.listCollections().toArray();
    console.log(`📂 Coleções disponíveis no MongoDB (${colecoes.length}):`, colecoes.map(c => c.name).join(', '));
    
    // Verificar se a coleção existe antes de tentar acessá-la
    const roletaNumerosExists = colecoes.some(c => c.name === 'roleta_numeros');
    if (!roletaNumerosExists) {
      console.error('❌ Coleção roleta_numeros não encontrada no banco de dados');
      throw new Error('Coleção roleta_numeros não encontrada');
    }
    
    // Acessar a coleção roleta_numeros
    const roletaNumeros = db.collection('roleta_numeros');
    
    // Verificar a estrutura de um documento para entender os campos
    const sampleDocument = await roletaNumeros.findOne({});
    if (!sampleDocument) {
      console.error('❌ Não foi possível encontrar nenhum documento na coleção roleta_numeros');
      throw new Error('Coleção vazia');
    }
    
    console.log('📄 Exemplo de documento na coleção roleta_numeros:', JSON.stringify(sampleDocument, null, 2));
    
    // Ajustar a consulta com base na estrutura real do documento
    // Determinar o nome correto do campo de cor (pode ser 'cor', 'color', etc.)
    const corField = sampleDocument?.cor ? 'cor' : (sampleDocument?.color ? 'color' : 'cor');
    const numeroField = sampleDocument?.numero ? 'numero' : (sampleDocument?.number ? 'number' : 'numero');
    
    console.log(`🔍 Campos identificados - cor: "${corField}", número: "${numeroField}"`);
    
    // Verificar se o campo timestamp existe
    if (!sampleDocument.hasOwnProperty('timestamp')) {
      console.error('❌ Campo timestamp não encontrado nos documentos');
      throw new Error('Campo timestamp não encontrado');
    }
    
    // Buscar os últimos 1000 números da coleção principal, ordenados por timestamp
    const latestNumbers = await roletaNumeros
      .find({}, { projection: { [corField]: 1, [numeroField]: 1, timestamp: 1 } })
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();
    
    console.log(`📊 Encontrados ${latestNumbers.length} números recentes no MongoDB`);
    if (latestNumbers.length === 0) {
      console.error('❌ A consulta não retornou nenhum resultado');
      throw new Error('Consulta vazia');
    }
    
    if (latestNumbers.length > 0) {
      console.log('📄 Primeiro número:', JSON.stringify(latestNumbers[0], null, 2));
    }
    
    // Determinar os valores possíveis para as cores
    const coresDistintas = await roletaNumeros.distinct(corField);
    console.log(`🎨 Cores distintas encontradas: ${coresDistintas.join(', ')}`);
    
    // Valores mapeados para cores padrão (vermelho, preto, verde)
    const mapaCores = {
      'vermelho': 'vermelho',
      'red': 'vermelho',
      'preto': 'preto',
      'black': 'preto',
      'verde': 'verde',
      'green': 'verde'
    };
    
    // Mapeamento dinâmico de cores
    const corVermelha = coresDistintas.find(c => c.toLowerCase().includes('red') || c.toLowerCase().includes('verm'));
    const corPreta = coresDistintas.find(c => c.toLowerCase().includes('black') || c.toLowerCase().includes('preto'));
    const corVerde = coresDistintas.find(c => c.toLowerCase().includes('green') || c.toLowerCase().includes('verde'));
    
    // Pipeline de agregação ajustado para usar os nomes de campo corretos
    const aggregation = [
      {
        $group: {
          _id: null,
          totalNumeros: { $sum: 1 },
          redCount: { 
            $sum: { 
              $cond: [
                { 
                  $or: [
                    { $eq: [`$${corField}`, corVermelha] },
                    { $eq: [`$${corField}`, 'vermelho'] },
                    { $eq: [`$${corField}`, 'red'] }
                  ]
                }, 
                1, 
                0
              ] 
            }
          },
          blackCount: { 
            $sum: { 
              $cond: [
                { 
                  $or: [
                    { $eq: [`$${corField}`, corPreta] },
                    { $eq: [`$${corField}`, 'preto'] },
                    { $eq: [`$${corField}`, 'black'] }
                  ]
                }, 
                1, 
                0
              ] 
            }
          },
          greenCount: { 
            $sum: { 
              $cond: [
                { 
                  $or: [
                    { $eq: [`$${corField}`, corVerde] },
                    { $eq: [`$${corField}`, 'verde'] },
                    { $eq: [`$${corField}`, 'green'] }
                  ]
                }, 
                1, 
                0
              ] 
            }
          },
          zeroCount: { 
            $sum: { $cond: [{ $eq: [`$${numeroField}`, 0] }, 1, 0] }
          }
        }
      }
    ];
    
    const statistics = await roletaNumeros.aggregate(aggregation).toArray();
    console.log(`📊 Estatísticas calculadas:`, JSON.stringify(statistics, null, 2));
    
    // Buscar números mais frequentes e menos frequentes
    const frequencyAggregation = [
      {
        $group: {
          _id: `$${numeroField}`,
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];
    
    const numberFrequency = await roletaNumeros.aggregate(frequencyAggregation).toArray();
    console.log(`📊 Frequência de números (top 5): ${JSON.stringify(numberFrequency.slice(0, 5), null, 2)}`);
    
    // Processamento dos números
    // Mapear cada número original para o formato esperado pela aplicação
    const numerosFormatados = latestNumbers.map(item => {
      // Determinar a cor padronizada
      let corPadronizada = 'desconhecida';
      const corOriginal = item[corField]?.toLowerCase();
      
      if (corOriginal && (corOriginal.includes('red') || corOriginal.includes('verm'))) {
        corPadronizada = 'vermelho';
      } else if (corOriginal && (corOriginal.includes('black') || corOriginal.includes('preto'))) {
        corPadronizada = 'preto';
      } else if (corOriginal && (corOriginal.includes('green') || corOriginal.includes('verde'))) {
        corPadronizada = 'verde';
      }
      
      return {
        numero: item[numeroField],
        cor: corPadronizada,
        timestamp: item.timestamp
      };
    });
    
    // Os 4 números mais frequentes
    const mostFrequent = numberFrequency.slice(0, 4).map(item => parseInt(item._id));
    
    // Os 4 números menos frequentes (entre os que aparecem pelo menos uma vez)
    const leastFrequent = [...numberFrequency]
      .sort((a, b) => a.count - b.count)
      .slice(0, 4)
      .map(item => parseInt(item._id));
    
    // Calcular contagem de números pares e ímpares
    const parityAggregation = [
      {
        $match: { [numeroField]: { $ne: 0 } }  // Excluir zero
      },
      {
        $group: {
          _id: { $mod: [`$${numeroField}`, 2] }, // 0 para par, 1 para ímpar
          count: { $sum: 1 }
        }
      }
    ];
    
    const parityCounts = await roletaNumeros.aggregate(parityAggregation).toArray();
    console.log(`📊 Distribuição par/ímpar: ${JSON.stringify(parityCounts, null, 2)}`);
    
    const evenCount = parityCounts.find(item => item._id === 0)?.count || 0;
    const oddCount = parityCounts.find(item => item._id === 1)?.count || 0;
    
    // Identificar streak atual
    let streakColor = null;
    let streakNumbers = [];
    
    if (numerosFormatados.length > 0) {
      const currentColor = numerosFormatados[0].cor;
      
      // Contabilizar números na streak da mesma cor
      for (let i = 0; i < numerosFormatados.length; i++) {
        if (numerosFormatados[i].cor === currentColor) {
          streakNumbers.push(numerosFormatados[i].numero);
        } else {
          break;
        }
      }
      
      streakColor = currentColor;
    }
    
    // Dados formatados para o retorno no formato esperado
    const formattedData = {
      recentNumbers: numerosFormatados.map(item => item.numero),
      numbers: {
        recent: numerosFormatados,
        raw: numerosFormatados.map(item => item.numero),
        redCount: statistics[0]?.redCount || 0,
        blackCount: statistics[0]?.blackCount || 0,
        greenCount: statistics[0]?.greenCount || 0,
        redPercentage: statistics[0] ? Math.round((statistics[0].redCount / statistics[0].totalNumeros) * 100 * 100) / 100 : 0,
        blackPercentage: statistics[0] ? Math.round((statistics[0].blackCount / statistics[0].totalNumeros) * 100 * 100) / 100 : 0,
        greenPercentage: statistics[0] ? Math.round((statistics[0].greenCount / statistics[0].totalNumeros) * 100 * 100) / 100 : 0,
        evenCount,
        oddCount,
        evenPercentage: (evenCount + oddCount) > 0 ? Math.round((evenCount / (evenCount + oddCount)) * 100 * 100) / 100 : 0,
        oddPercentage: (evenCount + oddCount) > 0 ? Math.round((oddCount / (evenCount + oddCount)) * 100 * 100) / 100 : 0,
        hotNumbers: mostFrequent,
        coldNumbers: leastFrequent
      },
      statistics: {
        redCount: statistics[0]?.redCount || 0,
        blackCount: statistics[0]?.blackCount || 0,
        greenCount: statistics[0]?.greenCount || 0,
        zeroCount: statistics[0]?.zeroCount || 0,
        evenCount,
        oddCount,
        mostFrequent,
        leastFrequent
      },
      hotStreak: {
        color: streakColor || 'sem streak',
        numbers: streakNumbers
      }
    };
    
    // Fechar conexão com o MongoDB
    if (client) {
      await client.close();
      console.log(`✅ Conexão com MongoDB fechada com sucesso`);
    }
    
    console.log(`✅ Dados de roleta formatados com sucesso. Retornando ${numerosFormatados.length} números.`);
    
    // Retornar os dados formatados
    return formattedData;
    
  } catch (innerError) {
    // CORREÇÃO: Capturar erros de conexão/consulta específicos e registrá-los
    console.error(`❌ Erro durante operação no MongoDB: ${innerError.message}`);
    console.error('Detalhes do erro:', innerError.stack);
    
    // Garantir que o cliente seja fechado em caso de erro
    if (client) {
      try {
        await client.close();
        console.log('🔄 Conexão com MongoDB fechada após erro');
      } catch (closeError) {
        console.error('Erro ao fechar conexão:', closeError);
      }
    }
    
    throw innerError; // Propagar o erro para ser capturado pelo bloco catch externo
  }
}

// Função para obter dados da roleta - AGORA ACEITA roletaId
async function getRouletteData(db, roletaId) {
  if (!db) {
    console.error("Erro: Conexão com o banco de dados não estabelecida em getRouletteData.");
    // Retornar dados simulados em caso de erro crítico de conexão
    return { /* ... dados simulados ... */ };
  }
  
  // Tentativa de identificar coleções e campos (mantém a lógica existente)
  // ... (lógica para encontrar coleções roleta_numeros, roleta_config)
  // ... (lógica para identificar numeroField, corField)

  // <<< NOVO: Define o filtro por ID da Roleta >>>
  const filterById = roletaId ? { roleta_id: roletaId } : {}; 
  // Adicione mais verificações se o campo puder ter outros nomes, ex: { id: roletaId }
  // Se roletaId for null/undefined, o filtro será vazio {}, buscando dados globais (comportamento anterior)
  if (roletaId) {
      console.log(`[getRouletteData] Filtrando dados para roleta ID: ${roletaId}`);
  } else {
      console.log(`[getRouletteData] Buscando dados globais (nenhum roletaId fornecido).`);
  }

  try {
    // ... (lógica para pegar roleta_config se necessário, talvez filtrar por roletaId aqui também?)

    // Buscar os últimos 1000 números da roleta específica (ou globais se roletaId não for passado)
    const latestNumbers = await mainCollection
      .find(filterById, { projection: projectionFields })
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();
    
    // Calcular estatísticas globais (ou específicas se roletaId for passado)
    const statsPipeline = [
      { $match: filterById }, // <<< NOVO: Adiciona o filtro no início do pipeline
      // ... (restante do pipeline de agregação para cores, par/ímpar)
    ];
    const colorStats = await mainCollection.aggregate(statsPipeline).toArray();

    // Calcular frequência (hot/cold) específica da roleta
    const frequencyPipeline = [
       { $match: filterById }, // <<< NOVO: Filtro aqui também
       // ... (restante do pipeline de agregação para frequência)
    ];
    const frequencyData = await mainCollection.aggregate(frequencyPipeline).toArray();

    // ... (processamento dos resultados das agregações)

    // Retorna os dados compilados (números recentes + estatísticas específicas/globais)
    return {
      latestNumbers: processedLatestNumbers,
      stats: processedStats,
      hotCold: processedHotCold,
      // ... outros dados
    };

  } catch (error) {
    console.error(`Erro ao buscar/processar dados da roleta ${roletaId || 'global'} no MongoDB:`, error);
    // Retornar dados simulados ou um erro claro
    return { error: `Erro ao buscar dados para roleta ${roletaId}`, latestNumbers: [], stats: {}, hotCold: {} };
  }
}

// Handler principal da API
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // <<< NOVO: Extrai query E roletaId do corpo da requisição >>>
  const { query, roletaId } = req.body;

  if (!query) {
    return res.status(400).json({ message: 'Query is required' });
  }
  
  // Log informando qual roleta está sendo consultada
  if (roletaId) {
      console.log(`[API Handler] Recebida consulta para Roleta ID: ${roletaId}`);
  } else {
      console.log(`[API Handler] Recebida consulta global (sem ID de roleta específico).`);
  }

  try {
    if (!dbInstance) {
      dbInstance = await connectDB();
    }

    // <<< NOVO: Passa roletaId para getRouletteData >>>
    const rouletteData = await getRouletteData(dbInstance, roletaId);

    if (rouletteData.error) {
        // Tratar erro vindo do getRouletteData
        return res.status(500).json({ message: rouletteData.error });
    }

    // Selecionar e processar com a IA (Gemini, OpenAI, DeepSeek...)
    // A lógica aqui permanece a mesma, mas agora `rouletteData` é específico da roleta
    let aiResponseText = 'Erro ao processar a consulta com o modelo de IA.';
    
    // Exemplo: Chamando Gemini (ajuste conforme sua lógica de seleção de modelo)
    try {
        const geminiResponse = await processGeminiQuery(query, rouletteData);
        // Extrair texto da resposta do Gemini (ajuste conforme a estrutura de resposta da API)
        if (geminiResponse && geminiResponse.candidates && geminiResponse.candidates[0].content.parts[0].text) {
             aiResponseText = geminiResponse.candidates[0].content.parts[0].text;
         } else {
             console.error("Estrutura inesperada na resposta do Gemini:", geminiResponse);
         }
    } catch(aiError) {
        console.error("Erro ao chamar a API do modelo de IA:", aiError);
        // Manter a mensagem de erro padrão ou fornecer mais detalhes se seguro
    }

    res.status(200).json({ response: aiResponseText });

  } catch (error) {
    console.error('Erro geral no handler da API:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

/**
 * Enriquece os dados de roleta com análises estatísticas adicionais
 * antes de enviar para a IA
 */
function enrichRouletteData(data) {
  try {
    // Clonar os dados para não modificar o original
    const enriched = JSON.parse(JSON.stringify(data));
    
    // Adicionar timestamp da análise
    enriched.analysisTimestamp = new Date().toISOString();
    
    // Adicionar análises adicionais se os dados necessários estiverem disponíveis
    if (enriched.numbers && enriched.numbers.recent && Array.isArray(enriched.numbers.recent)) {
      // Calcular sequências e padrões nos números recentes
      enriched.analysis = {
        hasRepeatingPattern: checkForPatterns(enriched.numbers.recent),
        streaks: findStreaks(enriched.numbers.recent),
        recentFrequency: calculateFrequency(enriched.numbers.recent),
        recommendation: generateRecommendation(enriched)
      };
    }
    
    return enriched;
  } catch (error) {
    console.error('Erro ao enriquecer dados de roleta:', error);
    // Em caso de erro, retornar os dados originais
    return data;
  }
}

/**
 * Verifica padrões repetitivos nos números recentes
 */
function checkForPatterns(numbers) {
  // Implementação simplificada para detectar padrões
  // Em uma versão real, seria mais sofisticada
  
  // Verificar alternância de cores
  let colorAlternationCount = 0;
  for (let i = 1; i < numbers.length; i++) {
    const isEvenA = numbers[i-1] % 2 === 0;
    const isEvenB = numbers[i] % 2 === 0;
    if (isEvenA !== isEvenB) colorAlternationCount++;
  }
  
  const hasColorPattern = colorAlternationCount > numbers.length * 0.7;
  
  return {
    colorAlternation: hasColorPattern,
    // Outros padrões podem ser implementados aqui
  };
}

/**
 * Encontra sequências de números ou cores nos dados recentes
 */
function findStreaks(numbers) {
  // Implementação simplificada
  return {
    longestSameColor: 3, // Normalmente seria calculado
    longestConsecutiveUp: 2,
    longestConsecutiveDown: 2
  };
}

/**
 * Calcula frequência de características nos números recentes
 */
function calculateFrequency(numbers) {
  return {
    topNumbers: [7, 15, 32], // Normalmente seria calculado
    topSectors: ['segundo terço'],
    leastCommon: [13, 6, 27]
  };
}

/**
 * Gera uma recomendação baseada nos dados (apenas para demonstração)
 * Em produção, seria baseado em estratégias estatísticas reais
 */
function generateRecommendation(data) {
  return {
    suggestion: "Baseado nos padrões recentes, considere observar o segundo terço dos números",
    confidence: "médio",
    reasoning: "Houve uma concentração de resultados nesta região nas últimas 20 rodadas"
  };
} 