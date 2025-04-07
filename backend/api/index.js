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
        { id: '2330046', nome: 'Speed Auto Roulette', numero: [] },
        { id: '2330047', nome: 'Immersive Roulette', numero: [] }
      ]);
    }
    
    // Listar todas as coleções disponíveis no banco de dados
    try {
      const collections = await db.listCollections().toArray();
      console.log('[API] Coleções disponíveis no banco de dados:', collections.map(c => c.name).join(', '));
    } catch (dbError) {
      console.error('[API] Erro ao listar coleções:', dbError);
    }
    
    // Buscar roletas diretamente da coleção 'roletas'
    const roletas = await db.collection('roletas').find({}).toArray();
    console.log(`[API] Encontradas ${roletas.length} roletas na coleção 'roletas'`);
    
    if (roletas.length === 0) {
      console.log('[API] Nenhuma roleta encontrada, retornando lista vazia');
      return res.json([]);
    }
    
    // Array para armazenar as promessas de busca de números
    const fetchPromises = [];
    
    // Para cada roleta encontrada, criar uma promessa para buscar os números mais recentes
    roletas.forEach((roleta) => {
      const originalId = roleta._id || roleta.id;
      const nome = roleta.nome || roleta.name || 'Roleta sem nome';
      
      console.log(`[API] Processando roleta: ${nome} (ID: ${originalId})`);
      
      // Mapeamento de nomes de roletas para IDs do scraper
      const nameMappings = {
        // IDs confirmados
        "Speed Auto Roulette": "2010096",
        "Auto-Roulette": "2010017",
        "Auto Roulette VIP": "2010098",
        "VIP Roulette": "2010098",
        "Immersive Roulette": "2010016",
        "Brazilian Mega Roulette": "2380335",
        "Bucharest Auto-Roulette": "2010065",
        // Outros mapeamentos comuns
        "Lightning Roulette": "2010033",
        "Auto Lightning Roulette": "2010154",
        "Ruleta Automática": "2010017", 
        "Svensk Roulette": "2010047",
        "Fan Tan": "72781e91",
        "Cash or Crash": "1887241b",
        "Dream Catcher": "ee6d8b6e",
        "Speed Roulette": "2010096",
        "Red Door Roulette": "b081a0c0",
        "777 Roulette": "2948054",
        "Japanese Roulette": "2010340",
        "Greek Roulette": "2837654",
        "Gold Vault Roulette": "2010565",
        "Dansk Roulette": "5629014"
      };
      
      // Tentar encontrar o ID do scraper baseado no nome da roleta
      const scraperId = nameMappings[nome];
      
      // Lista de possíveis IDs para buscar dados (original + scraper)
      const possibleIds = [originalId.toString()];
      if (scraperId) {
        possibleIds.push(scraperId);
      }
      
      // Consultar na coleção roleta_numeros usando os possíveis IDs
      const query = {
        $or: [
          ...possibleIds.map(id => ({ roleta_id: id })),
          ...possibleIds.map(id => ({ id_roleta: id })),
          { nome_roleta: nome },
          { roleta_nome: nome }
        ]
      };
      
      console.log(`[API] Buscando números para ${nome} com query:`, JSON.stringify(query));
      
      const promise = db.collection('roleta_numeros')
        .find(query)
        .sort({ timestamp: -1 })
        .limit(numbersLimit)
        .toArray()
        .then(async (numeros) => {
          console.log(`[API] Encontrados ${numeros.length} números para roleta ${nome} (ID: ${originalId})`);
          
          // Se não encontrou números e temos um ID do scraper, tentar diretamente com ele
          if (numeros.length === 0 && scraperId) {
            try {
              console.log(`[API] Tentando buscar com ID específico do scraper ${scraperId} para ${nome}`);
              
              const numerosAlt = await db.collection('roleta_numeros')
                .find({ roleta_id: scraperId })
                .sort({ timestamp: -1 })
                .limit(numbersLimit)
                .toArray();
              
              if (numerosAlt.length > 0) {
                console.log(`[API] Encontrados ${numerosAlt.length} números usando ID do scraper: ${scraperId}`);
                numeros = numerosAlt;
              }
            } catch (error) {
              console.error(`[API] Erro ao buscar números com ID do scraper:`, error);
            }
          }
          
          // Extrair o primeiro número para análise de debug (se houver)
          if (numeros.length > 0) {
            console.log(`[API] Exemplo de documento para ${nome}:`, 
              JSON.stringify(numeros[0], null, 2)
            );
          }
          
          return { 
            roletaId: originalId.toString(),
            numeros: numeros.map(n => ({
              numero: n.numero || n.number || n.value || 0,
              roleta_id: n.roleta_id || n.id_roleta || originalId.toString(),
              roleta_nome: n.roleta_nome || n.nome_roleta || nome,
              cor: n.cor || n.color || determinarCorNumero(n.numero || n.number || n.value || 0),
              timestamp: n.timestamp || n.created_at || n.criado_em || n.data || new Date().toISOString()
            }))
          };
        })
        .catch(error => {
          console.error(`[API] Erro ao buscar números para roleta ${nome} (ID: ${originalId}):`, error);
          return { roletaId: originalId.toString(), numeros: [] };
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
      const id = (r._id || r.id).toString();
      const numeros = numerosMap[id] || [];
      
      return {
        id: id,
        nome: r.nome || r.name,
        ativa: r.ativa || true,
        // Incluir os números buscados ou usar um array vazio como fallback
        numero: numeros,
        estado_estrategia: r.estado_estrategia || "NEUTRAL",
        vitorias: r.vitorias || 0,
        derrotas: r.derrotas || 0,
        win_rate: (r.vitorias || 0) + (r.derrotas || 0) > 0 
            ? `${((r.vitorias || 0) / ((r.vitorias || 0) + (r.derrotas || 0)) * 100).toFixed(1)}%` 
            : "N/A",
        updated_at: r.updated_at || r.atualizado_em || new Date().toISOString()
      };
    });
    
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
    
    console.log('[API] Roletas ordenadas - As com números aparecem primeiro');
    
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
