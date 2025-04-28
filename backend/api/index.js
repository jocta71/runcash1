const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Importar roteadores
const rouletteHistoryRouter = require('./routes/rouletteHistoryApi');
const strategiesRouter = require('./routes/strategies');
const authRouter = require('./routes/auth');

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME;
let db = null;

// Conectar ao MongoDB com Mongoose para os modelos
mongoose.connect(MONGODB_URI, {
  dbName: DB_NAME,
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Mongoose conectado ao MongoDB'))
.catch(err => console.error('Erro ao conectar Mongoose:', err));

// Conectar ao MongoDB
async function connectToMongoDB() {
  try {
    console.log(`Conectando ao MongoDB: ${MONGODB_URI.replace(/:.*@/, ':****@')}`);
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    db = client.db(DB_NAME);
    console.log(`Usando banco de dados: ${DB_NAME}`);
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
  origin: [
    'https://runcashh11.vercel.app',
    'https://runcash5.vercel.app', 
    'http://localhost:3000', 
    'http://localhost:5173', 
    'https://runcashh1.vercel.app', 
  
    'https://runcashh11.vercel.app',
    'https://backendapi-production-36b5.up.railway.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 
                 'ngrok-skip-browser-warning', 'bypass-tunnel-reminder', 'cache-control', 'pragma'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middleware
app.use(express.json());
app.use(cookieParser());

// Disponibilizar o banco de dados para os roteadores
app.locals.db = db;

// Configurar rotas
app.use('/api/roulettes/history', rouletteHistoryRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/auth', authRouter);

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
      // Primeiro, obter todas as roletas da coleção 'roletas'
      console.log('[API] Buscando todas as roletas da coleção roletas');
      const roletas = await db.collection('roletas').find({}).toArray();
      console.log(`[API] Encontradas ${roletas.length} roletas na coleção 'roletas'`);
      
      if (roletas.length === 0) {
        console.log('[API] Nenhuma roleta encontrada, retornando lista vazia');
        return res.json([]);
      }
      
      // Formatar roletas e criar uma promessa para buscar números para cada uma
      const fetchPromises = roletas.map(async (roleta) => {
        const id = roleta._id.toString();
        const nome = roleta.nome || 'Roleta sem nome';
        
        console.log(`[API] Processando roleta: ${nome} (ID: ${id})`);
        
        try {
          // Buscar números para esta roleta pelo nome
          console.log(`[API] Buscando números para roleta "${nome}"`);
          
          // Primeiro, vamos tentar uma busca exata
          let numeros = await db.collection('roleta_numeros')
            .find({ roleta_nome: nome })
            .sort({ timestamp: -1 })
            .limit(numbersLimit)
            .toArray();
            
          if (numeros.length === 0) {
            console.log(`[API] Busca exata não encontrou números para "${nome}", tentando busca case-insensitive`);
            
            // Se não encontrou com correspondência exata, tentar busca case-insensitive
            numeros = await db.collection('roleta_numeros')
              .find({ 
                roleta_nome: { 
                  $regex: new RegExp(`^${nome}$`, 'i')
                } 
              })
              .sort({ timestamp: -1 })
              .limit(numbersLimit)
              .toArray();
              
            if (numeros.length === 0) {
              console.log(`[API] Busca case-insensitive não encontrou números para "${nome}", tentando busca parcial`);
              
              // Se ainda não encontrou, tentar uma busca parcial
              numeros = await db.collection('roleta_numeros')
                .find({ 
                  roleta_nome: { 
                    $regex: new RegExp(`${nome.replace(/[-\s]/g, '.*')}`, 'i')
                  } 
                })
        .sort({ timestamp: -1 })
        .limit(numbersLimit)
                .toArray();
                
              if (numeros.length > 0) {
                console.log(`[API] Busca parcial encontrou ${numeros.length} números para "${nome}" => "${numeros[0].roleta_nome}"`);
              }
            } else {
              console.log(`[API] Busca case-insensitive encontrou ${numeros.length} números para "${nome}" => "${numeros[0].roleta_nome}"`);
            }
          }
          
          // Para diagnóstico, vamos verificar todas as roletas distintas na coleção
          if (numeros.length === 0) {
            // Fazemos isso apenas uma vez por eficiência
            if (!app.locals.listaRoletasNumeros) {
              const roletasDistintas = await db.collection('roleta_numeros').aggregate([
                { $group: { _id: "$roleta_nome", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
              ]).toArray();
              
              app.locals.listaRoletasNumeros = roletasDistintas.map(r => r._id);
              
              console.log('[API] DIAGNÓSTICO: Roletas disponíveis na coleção roleta_numeros:');
              roletasDistintas.forEach(r => {
                console.log(`- "${r._id}" (${r.count} números)`);
              });
            }
            
            // Sugerir correspondências possíveis
            console.log(`[API] Possíveis correspondências para "${nome}":`);
            const sugestoes = app.locals.listaRoletasNumeros
              .filter(rNome => rNome && rNome.toLowerCase().includes(nome.toLowerCase().substring(0, 5)))
              .slice(0, 3);
              
            if (sugestoes.length > 0) {
              sugestoes.forEach(s => console.log(`- "${s}"`));
            } else {
              console.log('- Nenhuma sugestão encontrada');
            }
          }
            
          console.log(`[API] Encontrados ${numeros.length} números para roleta ${nome}`);
          
          // Formatar números para o cliente
          const formattedNumbers = numeros.map(n => ({
            numero: n.numero || n.number || n.value || 0,
            roleta_id: n.roleta_id,
            roleta_nome: n.roleta_nome || nome,
            cor: n.cor || determinarCorNumero(n.numero || n.number || n.value || 0),
            timestamp: n.timestamp || n.created_at || n.criado_em || n.data || new Date().toISOString()
          }));
          
          return {
            id: id,
            nome: nome,
            ativa: roleta.ativa || true,
            numero: formattedNumbers,
            estado_estrategia: roleta.estado_estrategia || "NEUTRAL",
            vitorias: roleta.vitorias || 0,
            derrotas: roleta.derrotas || 0,
            win_rate: (roleta.vitorias || 0) + (roleta.derrotas || 0) > 0 
              ? `${((roleta.vitorias || 0) / ((roleta.vitorias || 0) + (roleta.derrotas || 0)) * 100).toFixed(1)}%` 
              : "N/A",
            updated_at: roleta.updated_at || roleta.atualizado_em || formattedNumbers.length > 0 
              ? formattedNumbers[0].timestamp 
              : new Date().toISOString()
          };
        } catch (error) {
          console.error(`[API] Erro ao buscar números para roleta ${nome}:`, error);
          // Retornar a roleta mesmo se houver erro ao buscar números
          return { 
            id: id,
            nome: nome,
            ativa: roleta.ativa || true,
            numero: [],
            estado_estrategia: roleta.estado_estrategia || "NEUTRAL",
            vitorias: roleta.vitorias || 0,
            derrotas: roleta.derrotas || 0,
            win_rate: (roleta.vitorias || 0) + (roleta.derrotas || 0) > 0 
              ? `${((roleta.vitorias || 0) / ((roleta.vitorias || 0) + (roleta.derrotas || 0)) * 100).toFixed(1)}%` 
              : "N/A",
            updated_at: roleta.updated_at || roleta.atualizado_em || new Date().toISOString()
          };
        }
      });
      
      // Aguardar todas as promessas
      let formattedRoulettes = await Promise.all(fetchPromises);
      
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
