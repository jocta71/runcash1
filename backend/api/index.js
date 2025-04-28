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
.then(() => console.log('[API] Mongoose conectado ao MongoDB'))
.catch(err => console.error('[API] Erro ao conectar Mongoose:', err));

// Conectar ao MongoDB
async function connectToMongoDB() {
  try {
    console.log(`[API] Conectando ao MongoDB: ${MONGODB_URI.replace(/:.*@/, ':****@')}`);
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('[API] Conectado ao MongoDB com sucesso');
    db = client.db(DB_NAME);
    console.log(`[API] Usando banco de dados: ${DB_NAME}`);
    return db;
  } catch (error) {
    console.error('[API] Erro ao conectar ao MongoDB:', error);
    return null;
  }
}

// Iniciar conexão com MongoDB
connectToMongoDB();

// Criar aplicação Express para a API
const apiApp = express();

// Configuração CORS básica
apiApp.use(cors({
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
apiApp.use(express.json());
apiApp.use(cookieParser());

// Disponibilizar o banco de dados para os roteadores
apiApp.locals.db = db;

// Configurar rotas
apiApp.use('/roulettes/history', rouletteHistoryRouter);
apiApp.use('/strategies', strategiesRouter);
apiApp.use('/auth', authRouter);


// Garantir que a rota /api/roulettes funcione
apiApp.get('/ROULETTES', async (req, res) => {
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
            if (!apiApp.locals.listaRoletasNumeros) {
              const roletasDistintas = await db.collection('roleta_numeros').aggregate([
                { $group: { _id: "$roleta_nome", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
              ]).toArray();
              
              apiApp.locals.listaRoletasNumeros = roletasDistintas.map(r => r._id);
              
              console.log('[API] DIAGNÓSTICO: Roletas disponíveis na coleção roleta_numeros:');
              roletasDistintas.forEach(r => {
                console.log(`- "${r._id}" (${r.count} números)`);
              });
            }
            
            // Sugerir correspondências possíveis
            console.log(`[API] Possíveis correspondências para "${nome}":`);
            const sugestoes = apiApp.locals.listaRoletasNumeros
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
      
      // Resolva todas as promessas e retorne os resultados
      const roletasComNumeros = await Promise.all(fetchPromises);
      console.log(`[API] Retornando ${roletasComNumeros.length} roletas com seus números`);
      
      return res.json(roletasComNumeros);
    } catch (error) {
      console.error(`[API] Erro ao buscar roletas: ${error}`);
      return res.status(500).json({ error: 'Erro ao buscar roletas e números' });
    }
  } catch (error) {
    console.error(`[API] Erro ao processar requisição /api/ROULETTES: ${error}`);
    return res.status(500).json({ error: 'Erro ao processar requisição' });
  }
});

// Rota para a API principal
apiApp.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'RunCash API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Função auxiliar para mapear entre IDs de roletas
function mapToCanonicalId(uuid) {
  // Mapear o UUID para um ID canônico se existir, caso contrário retornar o próprio UUID
  for (const [nome, id] of Object.entries(NOME_PARA_ID)) {
    if (uuid === id) return uuid;
  }
  return uuid;
}

// Função auxiliar para determinar a cor de um número da roleta
function determinarCorNumero(numero) {
  if (numero === 0) return 'green';
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(numero) ? 'red' : 'black';
}

// Se for executado diretamente (não importado como módulo), iniciar servidor
if (require.main === module) {
  const PORT = process.env.PORT || 3002;
  apiApp.listen(PORT, () => {
    console.log(`[API] Servidor iniciado na porta ${PORT}`);
});
}

// Exportar a aplicação para ser montada pelo arquivo principal
module.exports = apiApp;
