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
  "Speed Roulette": "2330046",
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
        { id: '2010096', nome: 'Speed Auto Roulette', numero: [] },
        { id: '2010016', nome: 'Immersive Roulette', numero: [] }
      ]);
    }
    
    try {
      // Buscar roletas diretamente da coleção 'roleta_numeros' agrupando por roleta_id e roleta_nome
      console.log('[API] Buscando roletas diretamente dos números registrados');
      
      // Primeiro, obtemos todos os IDs e nomes de roletas distintos da coleção 'roleta_numeros'
      const roletasDistintas = await db.collection('roleta_numeros').aggregate([
        { 
          $group: {
            _id: "$roleta_id",
            nome: { $first: "$roleta_nome" },
            quantidade: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            id: "$_id",
            nome: 1,
            quantidade: 1
          }
        },
        {
          $sort: { quantidade: -1 }
        }
      ]).toArray();
      
      console.log(`[API] Encontradas ${roletasDistintas.length} roletas distintas na coleção 'roleta_numeros'`);
      
      // Array para armazenar as promessas de busca de números
      const fetchPromises = [];
      
      // Para cada roleta distinta, criar uma promessa para buscar seus números mais recentes
      roletasDistintas.forEach((roleta) => {
        const roletaId = roleta.id;
        const nome = roleta.nome || 'Roleta sem nome';
        
        console.log(`[API] Processando roleta: ${nome} (ID: ${roletaId})`);
        
        const promise = db.collection('roleta_numeros')
          .find({ roleta_id: roletaId })
          .sort({ timestamp: -1 })
          .limit(numbersLimit)
          .toArray()
          .then(numeros => {
            console.log(`[API] Encontrados ${numeros.length} números para roleta ${nome} (ID: ${roletaId})`);
            
            // Formatar números para o cliente
            const formattedNumbers = numeros.map(n => ({
              numero: n.numero || n.number || n.value || 0,
              roleta_id: n.roleta_id,
              roleta_nome: n.roleta_nome || nome,
              cor: n.cor || determinarCorNumero(n.numero || n.number || n.value || 0),
              timestamp: n.timestamp || n.created_at || n.criado_em || n.data || new Date().toISOString()
            }));
            
            return {
              id: roletaId,
              nome: nome,
              ativa: true,
              numero: formattedNumbers,
              estado_estrategia: "NEUTRAL",
              vitorias: 0,
              derrotas: 0,
              win_rate: "N/A",
              updated_at: formattedNumbers.length > 0 ? formattedNumbers[0].timestamp : new Date().toISOString()
            };
          })
          .catch(error => {
            console.error(`[API] Erro ao buscar números para roleta ${nome} (ID: ${roletaId}):`, error);
            return {
              id: roletaId,
              nome: nome,
              ativa: true,
              numero: [],
              estado_estrategia: "NEUTRAL",
              vitorias: 0,
              derrotas: 0,
              win_rate: "N/A",
              updated_at: new Date().toISOString()
            };
          });
        
        fetchPromises.push(promise);
      });
      
      // Aguardar todas as promessas de busca de números
      let formattedRoulettes = await Promise.all(fetchPromises);
      
      // Verificar se existem roletas na coleção 'roletas' que não estão nos números
      // Isso garante que todas as roletas cadastradas apareçam, mesmo sem números ainda
      try {
        const roletasCadastradas = await db.collection('roletas').find({}).toArray();
        console.log(`[API] Verificando ${roletasCadastradas.length} roletas cadastradas na coleção 'roletas'`);
        
        // Adicionar roletas que existem na coleção 'roletas' mas não têm números ainda
        const idsExistentes = new Set(formattedRoulettes.map(r => r.id));
        
        for (const roleta of roletasCadastradas) {
          const nome = roleta.nome || roleta.name;
          // Se a roleta não existe na lista atual, adicionar
          if (nome && !idsExistentes.has(roleta._id.toString())) {
            console.log(`[API] Adicionando roleta cadastrada sem números: ${nome}`);
            formattedRoulettes.push({
              id: roleta._id.toString(),
              nome: nome,
              ativa: roleta.ativa || true,
              numero: [],
              estado_estrategia: roleta.estado_estrategia || "NEUTRAL",
              vitorias: roleta.vitorias || 0,
              derrotas: roleta.derrotas || 0,
              win_rate: "N/A",
              updated_at: roleta.updated_at || roleta.atualizado_em || new Date().toISOString()
            });
          }
        }
      } catch (roletasError) {
        console.error('[API] Erro ao obter roletas cadastradas:', roletasError);
      }
      
      // Ordenar roletas - as que têm números aparecem primeiro
      formattedRoulettes.sort((a, b) => {
        // Primeiro critério: roletas com números aparecem primeiro
        if (a.numero.length > 0 && b.numero.length === 0) return -1;
        if (a.numero.length === 0 && b.numero.length > 0) return 1;
        
        // Segundo critério: roletas com mais números aparecem antes
        if (a.numero.length !== b.numero.length) {
          return b.numero.length - a.numero.length;
        }
        
        // Terceiro critério: ordem alfabética pelo nome
        return (a.nome || '').localeCompare(b.nome || '');
      });
      
      console.log(`[API] Retornando ${formattedRoulettes.length} roletas no total`);
      return res.json(formattedRoulettes);
      
    } catch (error) {
      console.error('[API] Erro ao processar roletas:', error);
      return res.status(500).json({ error: 'Erro ao processar roletas', details: error.message });
    }
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
