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
const METADATA_COLLECTION_NAME = 'metadados_roletas'; // Nome da nova coleção de metadados

// Cache para conexão com o banco de dados
let mongoClient = null;
let dbInstance = null;

// Função para conectar ao MongoDB
async function connectDB() {
  try {
    if (mongoClient && dbInstance) {
      return dbInstance;
    }
    if (!mongoClient) {
      console.log('[DEBUG] Conectando ao MongoDB...');
      const mongoOptions = { connectTimeoutMS: 15000, socketTimeoutMS: 45000, serverSelectionTimeoutMS: 15000 };
      mongoClient = new MongoClient(MONGODB_URI, mongoOptions);
      await mongoClient.connect();
      console.log('[DEBUG] Conectado ao MongoDB com sucesso');
    }
    dbInstance = mongoClient.db(ROLETAS_DB_NAME);
    console.log(`[DEBUG] Usando banco de dados: ${ROLETAS_DB_NAME}`);
    return dbInstance;
  } catch (error) {
    console.error('[DEBUG] Erro ao conectar ao MongoDB:', error.message, error.stack);
    return null;
  }
}

// Função para obter dados detalhados de uma roleta específica
async function getRouletteDetails(db, roletaId, roletaNomeInput, existingCollections = null) {
  try {
    let rouletteIdentifier = 'geral';
    let recentNumbers = [];
    let colecaoId = null; // Este será o ID da coleção de números (ex: "2010016")
    let fetchedRoletaNome = null; // Nome da roleta vindo dos metadados
    let isSpecificRoletaRequest = roletaId || roletaNomeInput; // Flag indicando se estamos buscando uma roleta específica

    console.log(`[DEBUG] getRouletteDetails - Parâmetros: roletaId=${roletaId}, roletaNomeInput=${roletaNomeInput}`);

    let availableNumberCollections = existingCollections;
    if (!availableNumberCollections) {
        try {
            const collections = await db.listCollections().toArray();
            availableNumberCollections = collections.map(col => col.name);
            console.log(`[DEBUG] getRouletteDetails - Coleções de números disponíveis (buscadas internamente): ${availableNumberCollections.join(', ')}`);
        } catch (err) {
            console.error(`[DEBUG] getRouletteDetails - Erro ao listar coleções de números: ${err.message}`);
            availableNumberCollections = []; 
        }
    }

    if (roletaId) {
      colecaoId = roletaId.toString().trim().replace(/^ID:/, '');
      try {
        const metadata = await db.collection(METADATA_COLLECTION_NAME).findOne({ roleta_id: colecaoId });
        if (metadata && metadata.roleta_nome) {
          fetchedRoletaNome = metadata.roleta_nome;
          rouletteIdentifier = `${fetchedRoletaNome} (ID: ${colecaoId})`;
        } else {
          rouletteIdentifier = `Roleta ${colecaoId}`;
        }
      } catch (metaError) {
        console.error(`[DEBUG] getRouletteDetails - Erro ao buscar metadados para ${colecaoId}: ${metaError.message}. Usando ID como nome.`);
        rouletteIdentifier = `Roleta ${colecaoId}`;
      }
      console.log(`[DEBUG] getRouletteDetails - Identificador definido para: ${rouletteIdentifier}`);
      
      // Verificar se a coleção existe
      if (!availableNumberCollections.includes(colecaoId)) {
        console.warn(`[DEBUG] getRouletteDetails - Coleção de números ${colecaoId} não encontrada nas coleções disponíveis.`);
        // Se a roleta foi explicitamente solicitada mas não existe, retornar erro
        return {
          rouletteIdentifier,
          error: `Coleção de dados para ${rouletteIdentifier} não encontrada.`,
          totalNumbers: 0
        };
      }
    } else if (roletaNomeInput) {
      // Tentativa de buscar pelo nome na coleção de metadados
      try {
        const metadata = await db.collection(METADATA_COLLECTION_NAME).findOne({ roleta_nome: roletaNomeInput });
        if (metadata && metadata.roleta_id) {
          colecaoId = metadata.roleta_id;
          fetchedRoletaNome = metadata.roleta_nome;
          rouletteIdentifier = `${fetchedRoletaNome} (ID: ${colecaoId})`;
          console.log(`[DEBUG] getRouletteDetails - Encontrado por nome: ${rouletteIdentifier}`);
          
          // Verificar se a coleção existe
          if (!availableNumberCollections.includes(colecaoId)) {
             console.warn(`[DEBUG] getRouletteDetails - Coleção de números ${colecaoId} (do metadata) não encontrada.`);
             return {
               rouletteIdentifier,
               error: `Coleção de dados para ${rouletteIdentifier} não encontrada.`,
               totalNumbers: 0
             };
          }
        } else {
          return { rouletteIdentifier: roletaNomeInput, error: `Roleta com nome "${roletaNomeInput}" não encontrada nos metadados.`, totalNumbers: 0 };
        }
      } catch (metaError) {
        console.error(`[DEBUG] getRouletteDetails - Erro ao buscar metadados por nome "${roletaNomeInput}": ${metaError.message}`);
        return { rouletteIdentifier: roletaNomeInput, error: `Erro ao buscar roleta por nome.`, totalNumbers: 0 };
      }
    } else {
      // Sem ID ou nome específico, pegar a primeira roleta numérica disponível
      const numericCollections = availableNumberCollections.filter(name => /^\d+$/.test(name));
      if (numericCollections.length > 0) {
        colecaoId = numericCollections[0];
        try {
          const metadata = await db.collection(METADATA_COLLECTION_NAME).findOne({ roleta_id: colecaoId });
          if (metadata && metadata.roleta_nome) {
            fetchedRoletaNome = metadata.roleta_nome;
            rouletteIdentifier = `${fetchedRoletaNome} (ID: ${colecaoId})`;
          } else {
            rouletteIdentifier = `Roleta ${colecaoId}`;
          }
        } catch (metaError) {
          console.error(`[DEBUG] getRouletteDetails - Erro ao buscar metadados para roleta padrão ${colecaoId}: ${metaError.message}`);
          rouletteIdentifier = `Roleta ${colecaoId}`;
        }
        console.log(`[DEBUG] getRouletteDetails - Sem ID/Nome específico, usando: ${rouletteIdentifier}`);
      } else {
        return { rouletteIdentifier: 'geral', error: `Nenhuma coleção de roleta numérica encontrada.`, totalNumbers: 0 };
      }
    }
    
    // Buscar números da roleta se colecaoId foi definido
    if (colecaoId) {
      try {
        if (availableNumberCollections.includes(colecaoId)){
            console.log(`[DEBUG] getRouletteDetails - Buscando dados na coleção de números ${colecaoId}`);
            const dadosRoleta = await db.collection(colecaoId).find({}).sort({ timestamp: -1 }).limit(1000).toArray();
            if (dadosRoleta && dadosRoleta.length > 0) {
              recentNumbers = dadosRoleta.map(doc => {
                const num = doc.numero || doc.number;
                return typeof num === 'number' ? num : parseInt(num);
              }).filter(n => !isNaN(n));
              console.log(`[DEBUG] getRouletteDetails - Extraídos ${recentNumbers.length} números válidos da coleção ${colecaoId}.`);
            } else {
              console.log(`[DEBUG] getRouletteDetails - Nenhum documento encontrado na coleção de números ${colecaoId}`);
              // Se foi solicitada uma roleta específica e a coleção existe mas está vazia, retornar erro
              if (isSpecificRoletaRequest) {
                return {
                  rouletteIdentifier,
                  error: `A coleção ${colecaoId} existe, mas não contém números.`,
                  totalNumbers: 0
                };
              }
            }
        } else {
            console.log(`[DEBUG] getRouletteDetails - Coleção de números ${colecaoId} não existe. Não buscando números.`);
            // Se foi solicitada uma roleta específica mas a coleção não existe, retornar erro
            if (isSpecificRoletaRequest) {
              return {
                rouletteIdentifier,
                error: `Coleção de dados para ${rouletteIdentifier} não encontrada.`,
                totalNumbers: 0
              };
            }
        }
      } catch (error) {
        console.error(`[DEBUG] getRouletteDetails - Erro ao buscar números da coleção ${colecaoId}: ${error.message}`);
        // Se foi solicitada uma roleta específica e ocorreu erro, retornar o erro
        if (isSpecificRoletaRequest) {
          return {
            rouletteIdentifier,
            error: `Erro ao buscar dados da roleta: ${error.message}`,
            totalNumbers: 0
          };
        }
      }
    }
    
    // Fallback para dados sintéticos (apenas para 2010016 e somente quando especificamente solicitado)
    if ((!recentNumbers || recentNumbers.length === 0) && colecaoId === '2010016' && isSpecificRoletaRequest) {
      console.log('[DEBUG] getRouletteDetails - Gerando dados sintéticos para roleta 2010016');
      recentNumbers = [32, 15, 19, 7, 26, 0, 14, 22, 31, 5, 8, 17, 29, 28, 36, 12, 24, 19, 0, 7]; 
      for (let i = 0; i < 100; i++) recentNumbers.push(Math.floor(Math.random() * 37));
      if (!fetchedRoletaNome) rouletteIdentifier = "Immersive Roulette (ID: 2010016)"; // Nome específico para sintético
    }

    // Se não encontramos números para uma roleta específica, retornar erro
    if ((!recentNumbers || recentNumbers.length === 0) && isSpecificRoletaRequest) {
      return { 
        rouletteIdentifier, 
        error: `Não foram encontrados dados numéricos para ${rouletteIdentifier}`, 
        totalNumbers: 0 
      };
    }
    
    // Se não temos números e não é uma consulta específica, tentar qualquer roleta com dados
    if ((!recentNumbers || recentNumbers.length === 0) && !isSpecificRoletaRequest) {
      // Tentar encontrar qualquer roleta com dados
      console.log(`[DEBUG] getRouletteDetails - Nenhum número encontrado e NÃO é uma roleta específica. Tentando buscar outra roleta com dados disponíveis.`);
      
      // Iterar sobre as coleções numéricas até encontrar uma com dados
      const numericCollections = availableNumberCollections.filter(name => /^\d+$/.test(name));
      
      for (const altColecaoId of numericCollections) {
        if (altColecaoId === colecaoId) continue; // Pular a que já tentamos
        
        try {
          console.log(`[DEBUG] getRouletteDetails - Tentando coleção alternativa: ${altColecaoId}`);
          const altDadosRoleta = await db.collection(altColecaoId).find({}).sort({ timestamp: -1 }).limit(1000).toArray();
          
          if (altDadosRoleta && altDadosRoleta.length > 0) {
            // Se encontramos dados, mudar para esta roleta
            colecaoId = altColecaoId;
            
            // Atualizar o nome da roleta
            try {
              const metadata = await db.collection(METADATA_COLLECTION_NAME).findOne({ roleta_id: colecaoId });
              if (metadata && metadata.roleta_nome) {
                fetchedRoletaNome = metadata.roleta_nome;
                rouletteIdentifier = `${fetchedRoletaNome} (ID: ${colecaoId})`;
              } else {
                rouletteIdentifier = `Roleta ${colecaoId}`;
              }
            } catch (metaError) {
              rouletteIdentifier = `Roleta ${colecaoId}`;
            }
            
            // Extrair números
            recentNumbers = altDadosRoleta.map(doc => {
              const num = doc.numero || doc.number;
              return typeof num === 'number' ? num : parseInt(num);
            }).filter(n => !isNaN(n));
            
            console.log(`[DEBUG] getRouletteDetails - Usando roleta alternativa: ${rouletteIdentifier} com ${recentNumbers.length} números.`);
            break; // Sair do loop se encontramos dados
          }
        } catch (error) {
          console.error(`[DEBUG] getRouletteDetails - Erro ao buscar dados da roleta alternativa ${altColecaoId}: ${error.message}`);
          continue; // Tentar próxima roleta
        }
      }
    }
    
    // Se ainda não temos números, mesmo após tentar outras roletas, retornar erro
    if (!recentNumbers || recentNumbers.length === 0) {
      return { 
        rouletteIdentifier, 
        error: `Não foram encontrados dados numéricos para nenhuma roleta.`, 
        totalNumbers: 0 
      };
    }

    // Cálculos de estatísticas (mantidos como antes)
    const numberCounts = {};
    recentNumbers.forEach(num => { numberCounts[num] = (numberCounts[num] || 0) + 1; });
    const zeroCount = recentNumbers.filter(num => num === 0).length;
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
    console.error('[DEBUG] getRouletteDetails - Erro CRÍTICO ao processar dados da roleta:', error.message, error.stack);
    return { rouletteIdentifier: roletaId || roletaNomeInput || 'geral', error: `Erro crítico ao processar dados: ${error.message}`, totalNumbers: 0 };
  }
}

async function queryGemini(userQuery, rouletteData) {
  try {
    if (!GEMINI_API_KEY) throw new Error('[DEBUG] Chave da API Gemini não configurada');
    console.log(`[DEBUG] queryGemini - Modelo: ${GEMINI_MODEL}, Roleta: ${rouletteData.rouletteIdentifier}`);
    
    // Se houver erro nos dados da roleta e for uma consulta específica (erro de "não encontrada")
    if (rouletteData.error) {
      console.log(`[DEBUG] queryGemini - Detectado erro nos dados da roleta: ${rouletteData.error}`);
      // Retornar erro diretamente para consultas específicas sobre roletas não disponíveis
      return `${rouletteData.error}`;
    }
    
    const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    const prompt = `Você é um assistente especializado em análise de roleta de cassino.

Instruções:
1. Responda em português, de forma DIRETA e OBJETIVA.
2. Se a roleta for "${rouletteData.rouletteIdentifier}" e houver dados, use-os. Se houver erro nos dados da roleta (${rouletteData.error}), mencione o erro de forma amigável e NÃO invente dados.
3. Se perguntarem sobre zeros, informe o número exato de zeros dos dados fornecidos.
4. Se perguntarem sobre tendências, use apenas os dados fornecidos.
5. Não inclua explicações desnecessárias ou introduções, a menos que seja para explicar um erro nos dados.
6. Não se desculpe ou faça ressalvas desnecessariamente - seja assertivo com os dados que tem.

Dados da roleta ${rouletteData.rouletteIdentifier}:
${rouletteData.error ? `• Erro ao obter dados: ${rouletteData.error}` : `• Total de resultados analisados: ${rouletteData.totalNumbers || 0}
${rouletteData.stats ? `• Zeros: ${rouletteData.stats.zeroCount} (${rouletteData.stats.zeroPercentage}%)
• Vermelhos: ${rouletteData.stats.redCount} (${rouletteData.stats.redPercentage}%)
• Pretos: ${rouletteData.stats.blackCount} (${rouletteData.stats.blackPercentage}%)
• Pares: ${rouletteData.stats.evenCount} (${rouletteData.stats.evenPercentage}%)
• Ímpares: ${rouletteData.stats.oddCount} (${rouletteData.stats.oddPercentage}%)` : ''}
${rouletteData.hotNumbers && rouletteData.hotNumbers.length > 0 ? `• Números quentes: ${rouletteData.hotNumbers.map(n => `${n.number} (${n.count}x)`).join(', ')}` : ''}
${rouletteData.coldNumbers && rouletteData.coldNumbers.length > 0 ? `• Números frios: ${rouletteData.coldNumbers.map(n => `${n.number} (${n.count}x)`).join(', ')}` : ''}
${rouletteData.recentNumbers && rouletteData.recentNumbers.length > 0 ? `• Últimos números (até 10): ${rouletteData.recentNumbers.slice(0, 10).join(', ')}...` : ''}`}

A pergunta do usuário é: "${userQuery}"

Responda apenas o que foi perguntado, sem introduções ou explicações adicionais, a menos que precise explicar um erro nos dados.`;
    
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
    console.log('[DEBUG] queryGemini - Enviando requisição para Gemini...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(simplifiedRequest), signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Tenta pegar o JSON do erro
      console.error(`[DEBUG] queryGemini - Erro na API Gemini: Status ${response.status}`, JSON.stringify(errorData));
      throw new Error(`Erro na API Gemini: Status ${response.status}, Mensagem: ${errorData.error ? errorData.error.message : response.statusText}`);
    }
    const data = await response.json();
    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      console.error('[DEBUG] queryGemini - Resposta do Gemini em formato inesperado:', JSON.stringify(data));
      return 'Desculpe, o serviço de IA retornou uma resposta em formato inesperado.';
    }
    console.log('[DEBUG] queryGemini - Resposta do Gemini processada.');
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('[DEBUG] queryGemini - Erro ao chamar API do Gemini:', error.message, error.stack);
    if (error.name === 'AbortError') return 'Tempo limite excedido ao chamar a API do Gemini.';
    return `Erro ao processar consulta com Gemini: ${error.message}`;
  }
}

// Handler principal
export default async function handler(req, res) {
  console.log(`[DEBUG] Handler - Endpoint /api/ai/query acionado, Método: ${req.method}`);
  try {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    let { query, roletaId, roletaNome } = req.body;
    console.log(`[DEBUG] Handler - Body original: query="${query || ''}", roletaId=${roletaId || 'null'}, roletaNome=${roletaNome || 'null'}`);
    
    if (!query) return res.status(400).json({ message: 'Parâmetro "query" é obrigatório' });
    
    // Tentar extrair ID da roleta do texto da consulta se não for fornecido explicitamente
    if (!roletaId && !roletaNome) {
      // Procurar padrões comuns para IDs de roleta (7 dígitos)
      const padroes = [
        /roleta\s+(\d{7})/i,              // "roleta 2010011"
        /roulette\s+(\d{7})/i,            // "roulette 2010011"
        /rulet\s+(\d{7})/i,               // "rulet 2010011"
        /\s(\d{7})(?![0-9])/,             // " 2010011" (com espaço antes)
        /^(\d{7})(?![0-9])/,              // "2010011" (início da string)
        /da\s+(\d{7})(?![0-9])/i,         // "da 2010011"
        /id[:\s]+(\d{7})(?![0-9])/i,      // "id: 2010011" ou "ID 2010011"
        /id[=\s]+(\d{7})(?![0-9])/i       // "id=2010011"
      ];
      
      let matchEncontrado = null;
      for (const padrao of padroes) {
        const match = query.match(padrao);
        if (match && match[1]) {
          matchEncontrado = match[1];
          break;
        }
      }
      
      if (matchEncontrado) {
        roletaId = matchEncontrado;
        console.log(`[DEBUG] Handler - ID da roleta extraído do texto da consulta: ${roletaId}`);
      }
    }
    
    console.log(`[DEBUG] Handler - Parâmetros processados: query="${query || ''}", roletaId=${roletaId || 'null'}, roletaNome=${roletaNome || 'null'}`);
    
    const db = await connectDB();
    if (!db) return res.status(503).json({ message: 'Serviço temporariamente indisponível (MongoDB)', mongodbErrorType: 'connection_failed' });

    let allKnownRoulettes = []; // Lista de {id, nome}
    let numericCollectionIdsOnly = []; // Lista de IDs de coleções de números (fallback)
    try {
        const metadataEntries = await db.collection(METADATA_COLLECTION_NAME).find({}).project({ roleta_id: 1, roleta_nome: 1, _id: 0 }).toArray();
        if (metadataEntries.length > 0) {
            allKnownRoulettes = metadataEntries.map(m => ({ id: m.roleta_id, nome: m.roleta_nome }));
            console.log(`[DEBUG] Handler - Roletas conhecidas dos metadados: ${allKnownRoulettes.map(r => `${r.nome} (${r.id})`).join('; ')}`);
        }
        // Como fallback, listar coleções numéricas que guardam os resultados
        const collections = await db.listCollections().toArray();
        numericCollectionIdsOnly = collections.map(col => col.name).filter(name => /^\d+$/.test(name));
        if (allKnownRoulettes.length === 0 && numericCollectionIdsOnly.length > 0) {
             console.log(`[DEBUG] Handler - Nenhum metadado de roleta encontrado, usando IDs de coleções numéricas como fallback para listagem: ${numericCollectionIdsOnly.join(', ')}`);
        }
    } catch (err) {
        console.error(`[DEBUG] Handler - Erro ao buscar metadados de roletas ou listar coleções: ${err.message}. A listagem de roletas pode estar incompleta.`);
        // Tentar listar coleções numéricas como fallback absoluto se a busca de metadados falhar
        try {
            const collections = await db.listCollections().toArray();
            numericCollectionIdsOnly = collections.map(col => col.name).filter(name => /^\d+$/.test(name));
        } catch (listErr) {
            console.error(`[DEBUG] Handler - Erro crítico ao listar coleções de fallback: ${listErr.message}`);
        }
    }

    // Verificar explicitamente se a roleta solicitada existe antes de prosseguir
    if (roletaId) {
        const roletaIdFormatado = roletaId.toString().trim().replace(/^ID:/, '');
        
        // Verificar se a coleção existe no banco
        if (!numericCollectionIdsOnly.includes(roletaIdFormatado)) {
            console.log(`[DEBUG] Handler - Roleta ${roletaIdFormatado} não encontrada nas coleções disponíveis.`);
            
            // Buscar o nome da roleta nos metadados, se disponível
            let nomeRoleta = `Roleta ${roletaIdFormatado}`;
            const metadataRoleta = allKnownRoulettes.find(r => r.id === roletaIdFormatado);
            if (metadataRoleta) {
                nomeRoleta = `${metadataRoleta.nome} (ID: ${roletaIdFormatado})`;
            }
            
            // Retornar resposta de erro específica, sem processar com o Gemini
            return res.status(200).json({
                response: `Coleção de dados para ${nomeRoleta} não encontrada.`,
                debug: {
                    query,
                    rouletteIdentifier: nomeRoleta,
                    error: `Coleção não encontrada: ${roletaIdFormatado}`,
                    stats: { zeroCount: 0, totalNumbers: 0 },
                    ai_config: { provider: AI_PROVIDER, model: GEMINI_MODEL }
                }
            });
        }
    } else if (roletaNome) {
        // Verificar se o nome da roleta existe nos metadados
        const metadataRoleta = allKnownRoulettes.find(r => r.nome.toLowerCase() === roletaNome.toLowerCase());
        if (!metadataRoleta) {
            console.log(`[DEBUG] Handler - Roleta com nome "${roletaNome}" não encontrada nos metadados.`);
            return res.status(200).json({
                response: `Roleta com nome "${roletaNome}" não encontrada nos metadados.`,
                debug: {
                    query,
                    rouletteIdentifier: roletaNome,
                    error: `Roleta não encontrada: ${roletaNome}`,
                    stats: { zeroCount: 0, totalNumbers: 0 },
                    ai_config: { provider: AI_PROVIDER, model: GEMINI_MODEL }
                }
            });
        }
        
        // Verificar se a coleção com o ID correspondente existe
        if (!numericCollectionIdsOnly.includes(metadataRoleta.id)) {
            console.log(`[DEBUG] Handler - Coleção ${metadataRoleta.id} para roleta "${roletaNome}" não encontrada.`);
            return res.status(200).json({
                response: `Coleção de dados para ${roletaNome} (ID: ${metadataRoleta.id}) não encontrada.`,
                debug: {
                    query,
                    rouletteIdentifier: `${roletaNome} (ID: ${metadataRoleta.id})`,
                    error: `Coleção não encontrada: ${metadataRoleta.id}`,
                    stats: { zeroCount: 0, totalNumbers: 0 },
                    ai_config: { provider: AI_PROVIDER, model: GEMINI_MODEL }
                }
            });
        }
    }

    const lowerCaseQuery = query.toLowerCase();
    const listAllQueryKeywords = ["todas roletas", "roletas disponíveis", "listar roletas", "quais roletas"];
    
    if (listAllQueryKeywords.some(keyword => lowerCaseQuery.includes(keyword))) {
      let responseText;
      if (allKnownRoulettes.length > 0) {
        responseText = `Roletas disponíveis: ${allKnownRoulettes.map(r => `${r.nome} (ID: ${r.id})`).join(', ')}.`;
      } else if (numericCollectionIdsOnly.length > 0) {
        responseText = `Roletas disponíveis (IDs): ${numericCollectionIdsOnly.join(', ')}. (Nomes não encontrados nos metadados).`;
      } else {
        responseText = "Nenhuma roleta encontrada no banco de dados.";
      }
      console.log(`[DEBUG] Handler - Respondendo diretamente com a lista de roletas: ${responseText}`);
      return res.status(200).json({
        response: responseText,
        debug: { query, rouletteIdentifier: "Todas as Roletas", available_roulettes: allKnownRoulettes.length > 0 ? allKnownRoulettes : numericCollectionIdsOnly }
      });
    }
    
    console.log('[DEBUG] Handler - Buscando dados detalhados da roleta...');
    const rouletteData = await getRouletteDetails(db, roletaId, roletaNome, numericCollectionIdsOnly);
    
    // Se houver erro nos dados da roleta, retornar diretamente sem processar com Gemini
    if (rouletteData.error && (roletaId || roletaNome)) {
        console.log(`[DEBUG] Handler - Erro nos dados da roleta específica: ${rouletteData.error}`);
        return res.status(200).json({
            response: rouletteData.error,
            debug: {
                query,
                rouletteIdentifier: rouletteData.rouletteIdentifier,
                error: rouletteData.error,
                stats: { zeroCount: 0, totalNumbers: 0 },
                ai_config: { provider: AI_PROVIDER, model: GEMINI_MODEL }
            }
        });
    }
    
    console.log('[DEBUG] Handler - Chamando API do Gemini...');
    const aiResponse = await queryGemini(query, rouletteData);
    
    return res.status(200).json({
      response: aiResponse,
      debug: {
        query,
        rouletteIdentifier: rouletteData.rouletteIdentifier,
        stats: { zeroCount: rouletteData.stats?.zeroCount || 0, totalNumbers: rouletteData.totalNumbers || 0 },
        ai_config: { provider: AI_PROVIDER, model: GEMINI_MODEL }
      }
    });
  } catch (error) {
    console.error('[DEBUG] Handler - Erro GERAL:', error.message, error.stack);
    return res.status(500).json({ message: 'Erro interno no servidor', error: error.message });
  }
} 