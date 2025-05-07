const { MongoClient } = require('mongodb');
const readline = require('readline');

// Configurações
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const ROLETAS_DB_NAME = process.env.ROLETAS_MONGODB_DB_NAME || 'roletas_db';

// Cache para conexão com o banco de dados
let mongoClient = null;
let dbInstance = null;

// Criar interface de linha de comando
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para conectar ao MongoDB
async function connectDB() {
  try {
    // Verificar se já existe conexão para este banco
    if (mongoClient && dbInstance) {
      console.log(`[INFO] Usando instância MongoDB cacheada para banco ${ROLETAS_DB_NAME}`);
      return dbInstance;
    }

    // Se ainda não temos cliente MongoDB, criar um novo
    if (!mongoClient) {
      console.log('[INFO] Conectando ao MongoDB...');
      
      const mongoOptions = {
        connectTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 15000
      };
      
      mongoClient = new MongoClient(MONGODB_URI, mongoOptions);
      await mongoClient.connect();
      console.log('[INFO] Conectado ao MongoDB com sucesso');
    }
    
    // Obter instância do banco específico
    dbInstance = mongoClient.db(ROLETAS_DB_NAME);
    
    console.log(`[INFO] Usando banco de dados: ${ROLETAS_DB_NAME}`);
    return dbInstance;
  } catch (error) {
    console.error('[ERRO] Erro ao conectar ao MongoDB:', error.message);
    return null;
  }
}

// Função para obter dados detalhados de uma roleta específica
async function getRouletteDetails(db, roletaId, roletaNome) {
  try {
    let rouletteIdentifier = 'geral';
    let recentNumbers = [];
    let colecaoId = null;
    
    console.log('[INFO] Buscando dados no banco roletas_db');
    
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
          console.error(`[ERRO] Erro ao buscar metadados por ID: ${error.message}`);
        }
      }
      console.log(`[INFO] Filtrando por ID: ${roletaId}, coleção identificada: ${colecaoId || "nenhuma"}`);
    } 
    // Se temos nome, verificar se podemos encontrar o ID correspondente
    else if (roletaNome) {
      rouletteIdentifier = roletaNome;
      console.log(`[INFO] Filtrando por nome: ${roletaNome}`);
      
      try {
        // Verificar se existe um mapeamento na coleção metadados
        const metadata = await db.collection('metadados').findOne({
          roleta_nome: roletaNome
        });
        
        if (metadata && metadata.colecao) {
          colecaoId = metadata.colecao;
          console.log(`[INFO] Encontrado ID ${colecaoId} para roleta ${roletaNome} via metadados`);
        }
      } catch (error) {
        console.error(`[ERRO] Erro ao buscar metadados por nome: ${error.message}`);
      }
    } else {
      console.log('[INFO] Sem filtro específico, tentando listar coleções disponíveis');
      
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
          console.log(`[INFO] Sem filtro específico, usando primeira coleção disponível: ${colecaoId}`);
          
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
        console.error(`[ERRO] Erro ao listar coleções: ${error.message}`);
      }
    }
    
    // Se encontramos uma coleção específica, buscar os dados
    if (colecaoId) {
      try {
        // Verificar se a coleção existe
        const collections = await db.listCollections({name: colecaoId}).toArray();
        
        if (collections.length > 0) {
          console.log(`[INFO] Buscando na coleção específica ${colecaoId}`);
          
          const dadosRoleta = await db.collection(colecaoId)
            .find({})
            .sort({ timestamp: -1 })
            .limit(1000)
            .project({ _id: 0, numero: 1, timestamp: 1 })
            .toArray();
            
          if (dadosRoleta && dadosRoleta.length > 0) {
            console.log(`[INFO] Encontrados ${dadosRoleta.length} números na coleção ${colecaoId}`);
            // Extrair apenas os números
            recentNumbers = dadosRoleta.map(doc => doc.numero);
          } else {
            console.log(`[INFO] Nenhum número encontrado na coleção ${colecaoId}`);
          }
        } else {
          console.log(`[INFO] Coleção ${colecaoId} não encontrada no banco de dados`);
        }
      } catch (error) {
        console.error(`[ERRO] Erro ao buscar na coleção específica: ${error.message}`);
      }
    }
    
    // Se não encontramos números, retornar erro
    if (!recentNumbers || recentNumbers.length === 0) {
      console.log(`[INFO] Nenhum número encontrado para ${rouletteIdentifier}`);
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
    console.log(`[INFO] Quantidade de zeros: ${zeroCount}`);
    
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
    console.error('[ERRO] Erro ao processar dados da roleta:', error.message);
    return {
      rouletteIdentifier: roletaNome || roletaId || 'geral',
      error: `Erro ao processar dados: ${error.message}`
    };
  }
}

// Função para gerar uma resposta inteligente baseada nos dados
function generateAnswer(query, rouletteData) {
  const lowerQuery = query.toLowerCase();
  
  // Resposta para números quentes/frequentes
  if (lowerQuery.includes("quente") || lowerQuery.includes("frequente") || lowerQuery.includes("mais")) {
    const hotNumbersList = rouletteData.hotNumbers.map(n => `${n.number} (${n.count}x)`).join(", ");
    return `Os números mais frequentes na roleta ${rouletteData.rouletteIdentifier} são: ${hotNumbersList}`;
  }
  
  // Resposta para números frios/menos frequentes
  if (lowerQuery.includes("frio") || lowerQuery.includes("menos") || lowerQuery.includes("raro")) {
    const coldNumbersList = rouletteData.coldNumbers.map(n => `${n.number} (${n.count}x)`).join(", ");
    return `Os números menos frequentes são: ${coldNumbersList}`;
  }
  
  // Resposta sobre zeros
  if (lowerQuery.includes("zero")) {
    return `Zeros ocorreram ${rouletteData.stats.zeroCount} vezes (${rouletteData.stats.zeroPercentage}%) nos últimos ${rouletteData.totalNumbers} resultados`;
  }
  
  // Resposta sobre cores
  if (lowerQuery.includes("cor") || lowerQuery.includes("vermelho") || lowerQuery.includes("preto")) {
    return `Distribuição por cor: ${rouletteData.stats.redCount} vermelhos (${rouletteData.stats.redPercentage}%) e ${rouletteData.stats.blackCount} pretos (${rouletteData.stats.blackPercentage}%)`;
  }
  
  // Resposta sobre par/ímpar
  if (lowerQuery.includes("par") || lowerQuery.includes("ímpar") || lowerQuery.includes("impar")) {
    return `Distribuição par/ímpar: ${rouletteData.stats.evenCount} pares (${rouletteData.stats.evenPercentage}%) e ${rouletteData.stats.oddCount} ímpares (${rouletteData.stats.oddPercentage}%)`;
  }
  
  // Resposta sobre últimos números
  if (lowerQuery.includes("ultim") || lowerQuery.includes("último") || lowerQuery.includes("recente")) {
    return `Últimos números: ${rouletteData.recentNumbers.slice(0, 20).join(", ")}...`;
  }
  
  // Resposta genérica
  return `Analisando ${rouletteData.totalNumbers} resultados da roleta ${rouletteData.rouletteIdentifier}:
- Números quentes: ${rouletteData.hotNumbers.map(n => n.number).join(", ")}
- Números frios: ${rouletteData.coldNumbers.map(n => n.number).join(", ")}
- Zeros: ${rouletteData.stats.zeroCount} (${rouletteData.stats.zeroPercentage}%)
- Vermelho/Preto: ${rouletteData.stats.redCount}/${rouletteData.stats.blackCount}
- Par/Ímpar: ${rouletteData.stats.evenCount}/${rouletteData.stats.oddCount}`;
}

// Função para listar roletas disponíveis
async function listAvailableRoulettes(db) {
  try {
    console.log("\nBuscando roletas disponíveis...");
    
    // Primeiro tentar da coleção de metadados
    const metadados = await db.collection('metadados').find({ ativa: true })
      .project({ roleta_id: 1, roleta_nome: 1 })
      .toArray();
    
    if (metadados && metadados.length > 0) {
      console.log("\n=== ROLETAS DISPONÍVEIS ===");
      metadados.forEach((roleta, index) => {
        console.log(`${index + 1}. ${roleta.roleta_nome || 'Sem nome'} (ID: ${roleta.roleta_id || 'Desconhecido'})`);
      });
      return metadados;
    }
    
    // Se não encontrou pelos metadados, listar coleções
    const collections = await db.listCollections().toArray();
    const roletaCollections = collections.filter(col => 
      !col.name.startsWith('system.') && 
      !['metadados', 'estatisticas'].includes(col.name));
    
    if (roletaCollections.length > 0) {
      console.log("\n=== COLEÇÕES DE ROLETAS DISPONÍVEIS ===");
      roletaCollections.forEach((col, index) => {
        console.log(`${index + 1}. ${col.name}`);
      });
      
      return roletaCollections.map(col => ({
        roleta_id: col.name,
        roleta_nome: `Roleta ${col.name}`
      }));
    }
    
    console.log("\n[ERRO] Nenhuma roleta encontrada no banco de dados.");
    return [];
    
  } catch (error) {
    console.error("\n[ERRO] Falha ao listar roletas:", error.message);
    return [];
  }
}

// Função principal
async function main() {
  try {
    console.log("\n=== CONSULTA DE ROLETAS (BANCO ROLETAS_DB) ===");
    console.log("Conectando ao banco de dados...");
    
    // Conectar ao MongoDB
    const db = await connectDB();
    
    if (!db) {
      console.error("\n[ERRO FATAL] Falha ao conectar ao banco de dados. Encerrando.");
      rl.close();
      return;
    }
    
    // Listar roletas disponíveis
    const roletas = await listAvailableRoulettes(db);
    
    if (roletas.length === 0) {
      console.error("\n[ERRO] Nenhuma roleta encontrada. Encerrando.");
      rl.close();
      return;
    }
    
    // Interface de consulta
    const askQuestion = async () => {
      rl.question("\nDigite o número da roleta (ou 0 para sair): ", async (roletaIndex) => {
        // Verificar se deseja sair
        if (roletaIndex === '0') {
          console.log("\nEncerrando consulta...");
          
          if (mongoClient) {
            await mongoClient.close();
            console.log("Conexão com o banco fechada.");
          }
          
          rl.close();
          return;
        }
        
        // Verificar índice válido
        const index = parseInt(roletaIndex) - 1;
        if (isNaN(index) || index < 0 || index >= roletas.length) {
          console.log("\n[ERRO] Número de roleta inválido. Tente novamente.");
          return askQuestion();
        }
        
        // Selecionar roleta
        const roleta = roletas[index];
        console.log(`\nRoleta selecionada: ${roleta.roleta_nome} (ID: ${roleta.roleta_id})`);
        
        // Solicitar pergunta
        rl.question("\nSua pergunta sobre a roleta: ", async (query) => {
          // Verificar se é uma pergunta vazia
          if (!query.trim()) {
            console.log("\n[ERRO] Pergunta vazia. Tente novamente.");
            return askQuestion();
          }
          
          console.log("\nProcessando dados...");
          
          // Obter dados da roleta
          const rouletteData = await getRouletteDetails(db, roleta.roleta_id, roleta.roleta_nome);
          
          if (rouletteData.error) {
            console.log(`\n[ERRO] ${rouletteData.error}`);
            return askQuestion();
          }
          
          // Gerar resposta inteligente
          const answer = generateAnswer(query, rouletteData);
          
          // Exibir resposta
          console.log("\n=== RESPOSTA ===");
          console.log(answer);
          
          // Perguntar novamente
          rl.question("\nDeseja fazer outra pergunta? (s/n): ", (response) => {
            if (response.toLowerCase() === 's') {
              return askQuestion();
            } else {
              console.log("\nEncerrando consulta...");
              
              if (mongoClient) {
                mongoClient.close().then(() => {
                  console.log("Conexão com o banco fechada.");
                  rl.close();
                });
              } else {
                rl.close();
              }
            }
          });
        });
      });
    };
    
    // Iniciar ciclo de perguntas
    askQuestion();
    
  } catch (error) {
    console.error("\n[ERRO FATAL]", error);
    if (mongoClient) await mongoClient.close();
    rl.close();
  }
}

// Iniciar programa
main(); 