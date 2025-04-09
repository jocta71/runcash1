const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const COLLECTION_NAME = 'roleta_numeros';
const NODE_ENV = process.env.NODE_ENV || 'development';
const POLL_INTERVAL = 2000; // 2 segundos

// Middleware de segurança
app.use(helmet());

// Configuração CORS para produção
let corsOptions;
if (NODE_ENV === 'production') {
  corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  };
} else {
  corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  };
}

app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas requisições deste IP, tente novamente após 15 minutos'
});

// Aplicar rate limiting a todas as requisições
app.use(limiter);

// Variáveis globais
let db;
let collection;
let isConnected = false;
let mongoClient;
let lastProcessedIds = new Set();

// Logger
function logger(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (level === 'error') {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
}

// Função para conectar ao MongoDB com retry
async function connectToMongoDB(retryCount = 5, retryDelay = 5000) {
  try {
    logger('Tentando conectar ao MongoDB...');
    
    if (mongoClient) {
      await mongoClient.close();
      logger('Fechando conexão anterior com MongoDB');
    }
    
    mongoClient = new MongoClient(MONGODB_URI, {
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 60000,
      maxPoolSize: 10
    });
    
    await mongoClient.connect();
    db = mongoClient.db();
    collection = db.collection(COLLECTION_NAME);
    isConnected = true;
    logger('Conectado ao MongoDB com sucesso');
    return true;
  } catch (error) {
    logger(`Erro ao conectar ao MongoDB: ${error.message}`, 'error');
    isConnected = false;
    
    if (retryCount > 0) {
      logger(`Tentando reconectar em ${retryDelay/1000} segundos... (${retryCount} tentativas restantes)`);
      return new Promise(resolve => {
        setTimeout(async () => {
          resolve(await connectToMongoDB(retryCount - 1, retryDelay));
        }, retryDelay);
      });
    }
    
    return false;
  }
}

// Middleware para verificar conexão MongoDB
const ensureMongoConnected = async (req, res, next) => {
  if (!isConnected) {
    logger('Conexão com MongoDB perdida, tentando reconectar...');
    const reconnected = await connectToMongoDB();
    if (!reconnected) {
      return res.status(503).json({ 
        error: 'Serviço indisponível', 
        message: 'Não foi possível conectar ao banco de dados' 
      });
    }
  }
  next();
};

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  logger(`Erro não tratado: ${err.stack}`, 'error');
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: NODE_ENV === 'production' ? 'Ocorreu um erro inesperado' : err.message
  });
});

// Endpoints da API

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    environment: NODE_ENV,
    timestamp: new Date().toISOString() 
  });
});

// Status do servidor
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    environment: NODE_ENV,
    mongodb: isConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Obter últimos números
app.get('/numbers', ensureMongoConnected, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const roletaNome = req.query.roleta;

    // Validação de parâmetros
    if (limit > 100) {
      return res.status(400).json({ 
        error: 'Parâmetro inválido', 
        message: 'O limite máximo é 100 registros' 
      });
    }

    let query = {};
    if (roletaNome) {
      query.roleta_nome = roletaNome;
    }

    const numbers = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    res.json({
      success: true,
      count: numbers.length,
      data: numbers
    });
  } catch (error) {
    logger(`Erro ao buscar números: ${error.message}`, 'error');
    res.status(500).json({ 
      error: 'Erro ao buscar números',
      message: NODE_ENV === 'production' ? 'Ocorreu um erro ao consultar o banco de dados' : error.message
    });
  }
});

// Obter estratégias
app.get('/strategies', ensureMongoConnected, async (req, res) => {
  try {
    const roletaNome = req.query.roleta;
    const estrategiasCollection = db.collection('estrategia_historico_novo');

    let query = {};
    if (roletaNome) {
      query.roleta_nome = roletaNome;
    }

    const strategies = await estrategiasCollection
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();

    // Agrupar estratégias por roleta (pegando a mais recente)
    const estrategiasPorRoleta = {};
    strategies.forEach(strategy => {
      const roleta_id = strategy.roleta_id;
      if (!estrategiasPorRoleta[roleta_id] || 
          new Date(strategy.timestamp) > new Date(estrategiasPorRoleta[roleta_id].timestamp)) {
        estrategiasPorRoleta[roleta_id] = strategy;
      }
    });

    res.json({
      success: true,
      count: Object.values(estrategiasPorRoleta).length,
      data: Object.values(estrategiasPorRoleta)
    });
  } catch (error) {
    logger(`Erro ao buscar estratégias: ${error.message}`, 'error');
    res.status(500).json({ 
      error: 'Erro ao buscar estratégias',
      message: NODE_ENV === 'production' ? 'Ocorreu um erro ao consultar o banco de dados' : error.message 
    });
  }
});

// Rota 404 para endpoints não encontrados
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Não encontrado', 
    message: 'Endpoint não existe' 
  });
});

// Iniciar servidor com tratamento de erros
async function startServer() {
  try {
    const connected = await connectToMongoDB();
    if (!connected && NODE_ENV === 'production') {
      logger('Não foi possível conectar ao MongoDB. Encerrando aplicação...', 'error');
      process.exit(1);
    }
    
    const server = app.listen(PORT, () => {
      logger(`Servidor REST rodando na porta ${PORT} em modo ${NODE_ENV}`);
    });
    
    // Tratamento de erros do servidor
    server.on('error', (error) => {
      logger(`Erro no servidor: ${error.message}`, 'error');
      process.exit(1);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));
  } catch (error) {
    logger(`Erro fatal ao iniciar servidor: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Função para encerrar o servidor de forma segura
function gracefulShutdown(server) {
  logger('Encerrando servidor graciosamente...');
  server.close(async () => {
    logger('Fechando conexão com MongoDB...');
    if (mongoClient) {
      await mongoClient.close();
    }
    logger('Servidor encerrado com sucesso');
    process.exit(0);
  });
  
  // Se não fechar em 10 segundos, forçar encerramento
  setTimeout(() => {
    logger('Encerramento forçado após timeout', 'error');
    process.exit(1);
  }, 10000);
}

startServer(); 