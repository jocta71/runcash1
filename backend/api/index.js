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

// Adicionar mapeamento de nomes para IDs de roletas conhecidas
const NOME_PARA_ID = {
  "Speed Auto Roulette": "2330046",
  "Immersive Roulette": "2330047",
  "Brazilian Mega Roulette": "2330048",
  "Bucharest Auto-Roulette": "2330049",
  "Auto-Roulette": "2330050",
  "Auto-Roulette VIP": "2330051",
  "VIP Roulette": "2330052",
  "Roulette Macao": "2330053",
  "Speed Roulette 1": "2330054",
  "Hippodrome Grand Casino": "2330055",
  "Ruleta Bola Rapida en Vivo": "2330056",
  "Ruleta en Vivo": "2330057"
};

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
      const nome = roleta.nome || roleta.name || '';
      
      // Obter o roleta_id correto, primeiro checando o mapeamento por nome
      let roleta_id = NOME_PARA_ID[nome];
      
      // Se não encontrar no mapeamento por nome, usar o ID original diretamente
      if (!roleta_id) {
        roleta_id = originalId.toString();
      }
      
      console.log(`[API] Processando roleta: ${nome} (Original ID: ${originalId}, Roleta ID: ${roleta_id})`);
      
      // Consultar diretamente usando apenas roleta_id
      const promise = db.collection('roleta_numeros')
        .find({ roleta_id })
        .sort({ timestamp: -1 })
        .limit(numbersLimit)
        .toArray()
        .then(numeros => {
          console.log(`[API] Encontrados ${numeros.length} números para roleta ${nome} (ID: ${roleta_id})`);
          return { 
            roletaId: originalId,
            numeros: numeros.map(n => ({
              numero: n.numero,
              roleta_id: n.roleta_id,
              roleta_nome: n.roleta_nome || nome || 'Sem nome',
              cor: n.cor || determinarCorNumero(n.numero),
              timestamp: n.timestamp || n.created_at || n.criado_em || new Date().toISOString()
            }))
          };
        })
        .catch(error => {
          console.error(`[API] Erro ao buscar números para roleta ${nome} (ID: ${roleta_id}):`, error);
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
