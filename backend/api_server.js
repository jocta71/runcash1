const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const COLLECTION_NAME = 'roleta_numeros';
const POLL_INTERVAL = 2000; // 2 segundos

// Configuração CORS
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Variáveis globais
let db;
let collection;
let isConnected = false;
let lastProcessedIds = new Set();

// Função para conectar ao MongoDB
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    collection = db.collection(COLLECTION_NAME);
    isConnected = true;
    console.log('Conectado ao MongoDB com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    isConnected = false;
    return false;
  }
}

// Endpoints da API

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// Status do servidor
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    mongodb: isConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Obter últimos números
app.get('/numbers', async (req, res) => {
  try {
    if (!isConnected) {
      await connectToMongoDB();
    }

    const limit = parseInt(req.query.limit) || 20;
    const roletaNome = req.query.roleta;

    let query = {};
    if (roletaNome) {
      query.roleta_nome = roletaNome;
    }

    const numbers = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    res.json(numbers);
  } catch (error) {
    console.error('Erro ao buscar números:', error);
    res.status(500).json({ error: 'Erro ao buscar números' });
  }
});

// Obter estratégias
app.get('/strategies', async (req, res) => {
  try {
    if (!isConnected) {
      await connectToMongoDB();
    }

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

    res.json(Object.values(estrategiasPorRoleta));
  } catch (error) {
    console.error('Erro ao buscar estratégias:', error);
    res.status(500).json({ error: 'Erro ao buscar estratégias' });
  }
});

// Iniciar servidor
async function startServer() {
  try {
    await connectToMongoDB();
    app.listen(PORT, () => {
      console.log(`Servidor REST rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
  }
}

startServer(); 