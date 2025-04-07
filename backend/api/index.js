const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Importar roteadores
const rouletteHistoryRouter = require('./routes/rouletteHistoryApi');

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/runcash';
let db = null;

// Conectar ao MongoDB
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    db = client.db();
    return db;
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    return null;
  }
}

// Iniciar conexão com MongoDB
connectToMongoDB();

const app = express();
const PORT = process.env.PORT || 3002;

// Configuração CORS básica
app.use(cors({
  origin: ['https://runcash5.vercel.app', 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 
                 'ngrok-skip-browser-warning', 'bypass-tunnel-reminder', 'cache-control', 'pragma'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middleware
app.use(express.json());

// Disponibilizar o banco de dados para os roteadores
app.locals.db = db;

// Configurar rotas
app.use('/api/roulettes/history', rouletteHistoryRouter);

// Garantir que a rota /api/roulettes funcione
app.get('/api/ROULETTES', async (req, res) => {
  try {
    console.log('[API] Requisição recebida para /api/ROULETTES');
    
    // Obter o parâmetro limit da query string ou usar um valor padrão
    const numbersLimit = req.query.limit ? parseInt(req.query.limit) : 20;
    console.log(`[API] Parâmetro limit: ${numbersLimit}`);
    
    // Implementação alternativa caso não exista controlador ou MongoDB não esteja conectado
    if (!db) {
      console.log('[API] MongoDB não conectado, retornando dados simulados');
      return res.json([
        { id: '1', nome: 'Roleta Simulada 1', numero: [] },
        { id: '2', nome: 'Roleta Simulada 2', numero: [] }
      ]);
    }
    
    // Listar todas as coleções disponíveis no banco de dados
    try {
      const collections = await db.listCollections().toArray();
      console.log('[API] Coleções disponíveis no banco de dados:', collections.map(c => c.name).join(', '));
      
      // Verificar coleção de números das roletas
      const numerosSample = await db.collection('roleta_numeros').find({}).limit(5).toArray();
      console.log('[API] Amostra de dados da coleção roleta_numeros:');
      numerosSample.forEach((n, i) => {
        console.log(`[API] Registro ${i+1}:`, JSON.stringify({
          id: n._id,
          roleta_id: n.roleta_id,
          roleta_nome: n.roleta_nome,
          numero: n.numero,
          timestamp: n.timestamp,
          created_at: n.created_at,
          criado_em: n.criado_em
        }));
      });
    } catch (dbError) {
      console.error('[API] Erro ao listar coleções:', dbError);
    }
    
    // Buscar roletas diretamente
    const roulettes = await db.collection('roletas').find({}).toArray();
    console.log(`[API] Encontradas ${roulettes.length} roletas`);
    
    let roletasCollection = 'roletas';
    let roletas = roulettes;
    
    if (roulettes.length === 0) {
      // Tentar coleção alternativa
      console.log('[API] Nenhuma roleta encontrada na coleção "roletas", tentando "roulettes"...');
      const altRoulettes = await db.collection('roulettes').find({}).toArray();
      
      if (altRoulettes.length > 0) {
        console.log(`[API] Encontradas ${altRoulettes.length} roletas na coleção "roulettes"`);
        roletasCollection = 'roulettes';
        roletas = altRoulettes;
      }
    }
    
    // Array para armazenar as promessas de busca de números
    const fetchPromises = [];
    
    // Para cada roleta, criar uma promessa para buscar os números mais recentes
    roletas.forEach((roleta) => {
      const originalId = roleta.id || roleta._id;
      
      // IMPORTANTE: Usar o ID original diretamente
      const id = originalId.toString();
      
      // Tentar extrair um ID numérico, se existir
      let numericId = null;
      
      // Verificar se o ID já é numérico
      if (/^\d+$/.test(id)) {
        numericId = id;
      } else {
        // Tentar extrair números do ID
        const matches = id.match(/\d+/g);
        if (matches && matches.length > 0) {
          // Usar o maior número encontrado (geralmente é o ID)
          numericId = matches.reduce((a, b) => a.length > b.length ? a : b);
        }
      }
      
      console.log(`[API] Processando roleta: ${roleta.nome || roleta.name} (ID: ${id}, NumericID: ${numericId || 'Não encontrado'})`);
      
      // Lista de IDs possíveis para consulta
      const possibleIds = [id];
      
      // Adicionar ID numérico se encontrado
      if (numericId) {
        possibleIds.push(numericId);
      }
      
      // Lista de coleções para verificar, em ordem de prioridade
      const collections = ['roleta_numeros', 'numeros_roleta', 'roulette_numbers'];
      
      // Usar Promise.all para tentar todas as combinações de coleções e IDs
      const allQueries = [];
      
      for (const collectionName of collections) {
        // Verificar se a coleção existe
        allQueries.push(
          db.collection(collectionName)
            .find({
              $or: possibleIds.flatMap(possibleId => [
                { roleta_id: possibleId },
                { "roleta_id": possibleId },
                { "roulette_id": possibleId }
              ])
            })
            .sort({ timestamp: -1 })
            .limit(numbersLimit)
            .toArray()
            .then(results => {
              if (results && results.length > 0) {
                console.log(`[API] ✅ Encontrados ${results.length} números na coleção '${collectionName}' para ID ${results[0].roleta_id}`);
                return {
                  collection: collectionName,
                  roletaId: originalId,
                  matchedId: results[0].roleta_id,
                  numeros: results
                };
              }
              return null;
            })
            .catch(err => {
              console.error(`[API] Erro ao consultar coleção ${collectionName}:`, err);
              return null;
            })
        );
      }
      
      // Processar a primeira consulta bem-sucedida
      const promise = Promise.all(allQueries)
        .then(results => {
          // Filtrar resultados nulos
          const validResults = results.filter(Boolean);
          
          if (validResults.length > 0) {
            // Usar o primeiro resultado com números
            const firstResult = validResults[0];
            console.log(`[API] Usando dados da coleção '${firstResult.collection}' com ID ${firstResult.matchedId}`);
            
            return {
              roletaId: originalId,
              matchedId: firstResult.matchedId,
              numeros: firstResult.numeros.map(n => ({
                numero: n.numero || n.number || 0,
                roleta_id: n.roleta_id || n.roulette_id,
                roleta_nome: n.roleta_nome || n.roulette_name || roleta.nome || roleta.name || 'Sem nome',
                cor: n.cor || n.color || determinarCorNumero(n.numero || n.number || 0),
                timestamp: n.timestamp || n.created_at || n.criado_em || new Date().toISOString()
              }))
            };
          }
          
          // Se todas as consultas falharem
          console.log(`[API] ❌ Nenhum número encontrado para roleta ${roleta.nome || roleta.name} (ID: ${id})`);
          return { roletaId: originalId, numeros: [] };
        })
        .catch(error => {
          console.error(`[API] Erro ao buscar números para roleta ${id}:`, error);
          return { roletaId: originalId, numeros: [] };
        });
      
      fetchPromises.push(promise);
    });
    
    // Aguardar todas as promessas de busca de números
    const numerosResults = await Promise.all(fetchPromises);
    
    // Criar um mapa de ID da roleta para seus números
    const numerosMap = {};
    numerosResults.forEach(result => {
      numerosMap[result.roletaId] = result.numeros;
    });
    
    // Formatar roletas para uniformidade, incluindo os números
    const formattedRoulettes = roletas.map(r => {
      const id = r.id || r._id;
      
      return {
        id: id,
        nome: r.nome || r.name,
        // Incluir os números buscados ou usar um array vazio como fallback
        numero: numerosMap[id] || [],
        estado_estrategia: r.estado_estrategia || "NEUTRAL",
        vitorias: r.vitorias || 0,
        derrotas: r.derrotas || 0,
        win_rate: (r.vitorias || 0) + (r.derrotas || 0) > 0 ? `${((r.vitorias || 0) / ((r.vitorias || 0) + (r.derrotas || 0)) * 100).toFixed(1)}%` : "N/A",
        updated_at: r.updated_at || new Date().toISOString()
      };
    });
    
    return res.json(formattedRoulettes);
  } catch (error) {
    console.error('[API] Erro ao buscar roletas:', error);
    res.status(500).json({ error: 'Erro interno ao buscar roletas', details: error.message });
  }
});

// Função para mapear UUIDs para IDs canônicos
function mapToCanonicalId(uuid) {
  // MODIFICAÇÃO CRÍTICA: Retornar o ID original diretamente sem conversão
  // Isso permite que todas as roletas sejam exibidas, sem limitação pelos IDs canônicos
  console.log(`[API] MODO PERMISSIVO: Usando ID original ${uuid} sem conversão`);
  return uuid;
}

// Função auxiliar para determinar a cor de um número da roleta
function determinarCorNumero(numero) {
  if (numero === 0) return 'verde';
  
  // Números vermelhos na roleta europeia
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
}

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
