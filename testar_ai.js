const { MongoClient } = require('mongodb');

// Configurações
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

// Função simulada para testar a IA
function simulateAIResponse(rouletteData, query) {
  console.log("\n=== SIMULAÇÃO DE RESPOSTA DA IA ===");
  console.log(`Pergunta: "${query}"`);
  console.log("\nDados disponíveis para a IA:");
  console.log(`- Roleta: ${rouletteData.rouletteIdentifier}`);
  console.log(`- Total de resultados: ${rouletteData.totalNumbers}`);
  console.log(`- Zeros: ${rouletteData.stats.zeroCount} (${rouletteData.stats.zeroPercentage}%)`);
  console.log(`- Últimos números: ${rouletteData.recentNumbers.slice(0, 10).join(", ")}...`);
  console.log(`- Números quentes: ${rouletteData.hotNumbers.map(n => n.number).join(", ")}`);
  console.log(`- Números frios: ${rouletteData.coldNumbers.map(n => n.number).join(", ")}`);
  console.log(`- Vermelho/Preto: ${rouletteData.stats.redCount}/${rouletteData.stats.blackCount}`);
  console.log(`- Par/Ímpar: ${rouletteData.stats.evenCount}/${rouletteData.stats.oddCount}`);
  
  // Simulação de resposta baseada na pergunta
  let resposta = "";
  
  if (query.toLowerCase().includes("quente") || query.toLowerCase().includes("frequente")) {
    resposta = `Os números mais frequentes são: ${rouletteData.hotNumbers.map(n => n.number).join(", ")}`;
  } else if (query.toLowerCase().includes("frio") || query.toLowerCase().includes("menos frequente")) {
    resposta = `Os números menos frequentes são: ${rouletteData.coldNumbers.map(n => n.number).join(", ")}`;
  } else if (query.toLowerCase().includes("zero")) {
    resposta = `Zeros ocorreram ${rouletteData.stats.zeroCount} vezes (${rouletteData.stats.zeroPercentage}%)`;
  } else if (query.toLowerCase().includes("vermelho") || query.toLowerCase().includes("preto")) {
    resposta = `Distribuição por cor: ${rouletteData.stats.redCount} vermelhos (${rouletteData.stats.redPercentage}%) e ${rouletteData.stats.blackCount} pretos (${rouletteData.stats.blackPercentage}%)`;
  } else if (query.toLowerCase().includes("par") || query.toLowerCase().includes("ímpar")) {
    resposta = `Distribuição par/ímpar: ${rouletteData.stats.evenCount} pares (${rouletteData.stats.evenPercentage}%) e ${rouletteData.stats.oddCount} ímpares (${rouletteData.stats.oddPercentage}%)`;
  } else {
    resposta = `Analisando ${rouletteData.totalNumbers} resultados da roleta ${rouletteData.rouletteIdentifier}. Os números mais frequentes são ${rouletteData.hotNumbers.map(n => n.number).join(", ")} e os menos frequentes são ${rouletteData.coldNumbers.map(n => n.number).join(", ")}.`;
  }
  
  console.log("\nResposta simulada da IA:");
  console.log(resposta);
  
  return resposta;
}

// Função principal para testar a IA
async function testarIA() {
  try {
    console.log("Iniciando teste da IA com banco roletas_db...");
    
    // Conectar ao banco de dados
    const db = await connectDB();
    if (!db) {
      throw new Error("Falha ao conectar ao banco de dados");
    }
    
    // Testes com diferentes roletas e consultas
    const testes = [
      { roletaId: "2010097", query: "oi, tudo?" },
      { roletaId: "2010165", query: "Qual a frequência de zeros?" },
      { roletaNome: "Roulette", query: "Qual a proporção entre vermelhos e pretos?" },
      { query: "Qual o número que menos aparece?" } // Sem especificar roleta
    ];
    
    // Executar cada teste
    for (const teste of testes) {
      console.log("\n======================================================");
      console.log(`TESTE: ${JSON.stringify(teste)}`);
      
      // Obter dados da roleta
      const rouletteData = await getRouletteDetails(db, teste.roletaId, teste.roletaNome);
      
      if (rouletteData.error) {
        console.log(`[ERRO] ${rouletteData.error}`);
        continue;
      }
      
      // Simular resposta da IA
      simulateAIResponse(rouletteData, teste.query);
    }
    
    // Fechar conexão
    if (mongoClient) {
      await mongoClient.close();
      console.log("\nConexão com o MongoDB fechada");
    }
    
    console.log("\nTestes da IA concluídos com sucesso!");
    
  } catch (error) {
    console.error("Erro durante teste da IA:", error);
  }
}

// Executar teste
testarIA(); 