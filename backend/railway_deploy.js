/**
 * SCRIPT DE IMPLANTAÇÃO PARA RAILWAY
 * Este arquivo simplifica o servidor para implantação no Railway,
 * removendo a verificação de autenticação para endpoints de roletas.
 */

const express = require('express');
const http = require('http');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const COLLECTION_NAME = 'roleta_numeros';

console.log('==== RAILWAY DEPLOYMENT ====');
console.log(`PORT: ${PORT}`);
console.log(`MONGODB_URI: ${MONGODB_URI ? MONGODB_URI.replace(/:.*@/, ':****@') : 'Não definida'}`);
console.log(`COLLECTION_NAME: ${COLLECTION_NAME}`);

// Inicializar Express
const app = express();

// Aplicar middleware
app.use(express.json());
app.use(cors());

// Aplicar cabeçalhos CORS para todas as requisições
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Status e informações do servidor
let isConnected = false;
let db, collection;

// Conectar ao MongoDB
async function connectToMongoDB() {
  try {
    console.log('Conectando ao MongoDB...');
    
    const client = new MongoClient(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    db = client.db('runcash');
    collection = db.collection(COLLECTION_NAME);
    isConnected = true;
    
    return true;
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    isConnected = false;
    return false;
  }
}

// Rota principal
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'RunCash API (Railway)',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      roulettes: ['/api/roulettes', '/api/ROULETTES', '/api/roletas']
    }
  });
});

// Status do servidor
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    mongodb_connected: isConnected,
    version: '2.0.0',
    environment: 'railway',
    timestamp: new Date().toISOString()
  });
});

// ENDPOINT PÚBLICO: Obter lista de roletas (sem autenticação)
app.get('/api/roulettes', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[API ${requestId}] Acesso público ao endpoint /api/roulettes`);
  
  try {
    if (!isConnected || !collection) {
      console.log(`[API ${requestId}] MongoDB não conectado`);
      return res.json([]);
    }
    
    // Obter roletas únicas da coleção
    const roulettes = await collection.aggregate([
      { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
      { $project: { _id: 0, id: 1, nome: "$_id" } }
    ]).toArray();
    
    console.log(`[API ${requestId}] Retornando ${roulettes.length} roletas`);
    return res.json(roulettes);
  } catch (error) {
    console.error(`[API ${requestId}] Erro:`, error);
    return res.status(500).json({ 
      error: 'Erro interno ao buscar roletas',
      message: error.message,
      requestId: requestId
    });
  }
});

// ENDPOINT PÚBLICO: Também funciona com letras maiúsculas (sem autenticação)
app.get('/api/ROULETTES', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[API ${requestId}] Acesso público ao endpoint /api/ROULETTES`);
  
  try {
    if (!isConnected || !collection) {
      console.log(`[API ${requestId}] MongoDB não conectado`);
      return res.json([]);
    }
    
    // Obter roletas únicas da coleção
    const roulettes = await collection.aggregate([
      { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
      { $project: { _id: 0, id: 1, nome: "$_id" } }
    ]).toArray();
    
    console.log(`[API ${requestId}] Retornando ${roulettes.length} roletas`);
    return res.json(roulettes);
  } catch (error) {
    console.error(`[API ${requestId}] Erro:`, error);
    return res.status(500).json({ 
      error: 'Erro interno ao buscar roletas',
      message: error.message,
      requestId: requestId
    });
  }
});

// ENDPOINT PÚBLICO: Versão em português (sem autenticação)
app.get('/api/roletas', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[API ${requestId}] Acesso público ao endpoint /api/roletas`);
  
  try {
    if (!isConnected || !collection) {
      console.log(`[API ${requestId}] MongoDB não conectado`);
      return res.json([]);
    }
    
    // Obter roletas únicas da coleção
    const roulettes = await collection.aggregate([
      { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
      { $project: { _id: 0, id: 1, nome: "$_id" } }
    ]).toArray();
    
    console.log(`[API ${requestId}] Retornando ${roulettes.length} roletas`);
    return res.json(roulettes);
  } catch (error) {
    console.error(`[API ${requestId}] Erro:`, error);
    return res.status(500).json({ 
      error: 'Erro interno ao buscar roletas',
      message: error.message,
      requestId: requestId
    });
  }
});

// Iniciar o servidor
async function startServer() {
  // Conectar ao MongoDB
  await connectToMongoDB();
  
  // Criar servidor HTTP
  const server = http.createServer(app);
  
  // Iniciar servidor na porta especificada
  server.listen(PORT, () => {
    console.log(`Servidor Railway iniciado na porta ${PORT}`);
    console.log('Endpoints de roleta disponíveis SEM autenticação:');
    console.log('- /api/roulettes');
    console.log('- /api/ROULETTES');
    console.log('- /api/roletas');
  });
}

// Iniciar servidor
startServer().catch(error => {
  console.error('Erro ao iniciar servidor:', error);
}); 