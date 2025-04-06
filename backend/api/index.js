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
      // Converter UUID para ID canônico
      const id = mapToCanonicalId(originalId.toString());
      
      const promise = db.collection('roleta_numeros')
        .find({ roleta_id: id.toString() })
        .sort({ timestamp: -1 })
        .limit(numbersLimit)
        .toArray()
        .then(numeros => {
          console.log(`[API] Encontrados ${numeros.length} números para roleta ${id} (original: ${originalId})`);
          return { 
            roletaId: originalId, // Manter o ID original para mapeamento
            canonicalId: id, // Adicionar o ID canônico para referência
            numeros: numeros.map(n => ({
              numero: n.numero,
              roleta_id: n.roleta_id,
              roleta_nome: n.roleta_nome,
              cor: n.cor || determinarCorNumero(n.numero),
              timestamp: n.timestamp || n.created_at || n.criado_em
            }))
          };
        })
        .catch(error => {
          console.error(`[API] Erro ao buscar números para roleta ${id}:`, error);
          return { roletaId: originalId, canonicalId: id, numeros: [] };
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
      const canonicalId = mapToCanonicalId(id.toString());
      
      return {
        id: id,
        canonical_id: canonicalId, // Adicionar ID canônico para referência
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
  // Remover traços para normalização
  const normalizedUuid = uuid.replace(/-/g, '').toLowerCase();
  
  // Mapeamento direto de UUIDs para IDs canônicos
  const uuidToCanonicalMap = {
    // Brazilian Mega Roulette
    '7d3c2c9f2850f642861f5bb4daf1806a': '2380335',
    '7d3c2c9f-2850-f642-861f-5bb4daf1806a': '2380335',
    
    // Speed Auto Roulette
    '18bdc4ead884c47ad33f27a268a4eead': '2010096',
    '18bdc4ea-d884-c47a-d33f-27a268a4eead': '2010096',
    
    // Bucharest Auto-Roulette
    'e3345af9e3879412209ce793fe73e520': '2010065',
    'e3345af9-e387-9412-209c-e793fe73e520': '2010065',
    
    // Auto-Roulette VIP
    '419aa56cbcff67d2f424a6501bac4a36': '2010098',
    '419aa56c-bcff-67d2-f424-a6501bac4a36': '2010098',
    
    // Immersive Roulette
    '4cf27e482b9db58e7dcc48264c51d639': '2010016',
    '4cf27e48-2b9d-b58e-7dcc-48264c51d639': '2010016',
    
    // Auto-Roulette (Ruleta Automática)
    'f27dd03e5282fc78961c6375cef91565': '2010017',
    'f27dd03e-5282-fc78-961c-6375cef91565': '2010017'
  };
  
  // Verificar se o UUID existe diretamente no mapeamento
  if (uuidToCanonicalMap[uuid]) {
    console.log(`[API] Convertendo UUID ${uuid} para ID canônico ${uuidToCanonicalMap[uuid]}`);
    return uuidToCanonicalMap[uuid];
  }
  
  // Verificar se o UUID normalizado existe no mapeamento
  if (uuidToCanonicalMap[normalizedUuid]) {
    console.log(`[API] Convertendo UUID normalizado ${normalizedUuid} para ID canônico ${uuidToCanonicalMap[normalizedUuid]}`);
    return uuidToCanonicalMap[normalizedUuid];
  }
  
  // Se não encontrou correspondência, tenta verificar se o próprio UUID já é um ID canônico
  const canonicalIds = ['2010016', '2380335', '2010065', '2010096', '2010017', '2010098'];
  if (canonicalIds.includes(uuid)) {
    console.log(`[API] UUID ${uuid} já é um ID canônico, usando diretamente`);
    return uuid;
  }
  
  // Tenta usar como ID direto se for numérico
  if (/^\d+$/.test(uuid)) {
    console.log(`[API] UUID ${uuid} é numérico, assumindo que é um ID canônico`);
    return uuid;
  }
  
  // Se tudo falhar, retorna o ID original
  console.warn(`[API] ⚠️ Não foi possível converter UUID ${uuid} para ID canônico - usando original`);
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
