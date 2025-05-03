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
const webhookRoutes = require('./routes/webhookRoutes');

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
apiApp.use('/webhooks', webhookRoutes);

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
              console.log(`[API] Busca case-insensitive também não encontrou números para "${nome}", retornando lista vazia`);
              return res.json([]);
            }
          }
          
          return { id, nome, numeros };
        } catch (error) {
          console.error(`[API] Erro ao buscar números para roleta "${nome}":`, error);
          return null;
        }
      });
      
      const results = await Promise.all(fetchPromises);
      
      if (results.length === 0) {
        console.log('[API] Nenhuma roleta encontrada, retornando lista vazia');
        return res.json([]);
      }
      
      return res.json(results);
    } catch (error) {
      console.error('[API] Erro ao buscar roletas:', error);
      return res.status(500).json({ error: 'Erro ao buscar roletas' });
    }
  } catch (error) {
    console.error('[API] Erro ao processar requisição:', error);
    return res.status(500).json({ error: 'Erro ao processar requisição' });
  }
});

// Iniciar o servidor
const PORT = process.env.PORT || 3001;
apiApp.listen(PORT, () => {
  console.log(`[API] Servidor iniciado na porta ${PORT}`);
});