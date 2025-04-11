const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

// Configuração
const PORT = 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = 'runcash';

// Inicializar app
const app = express();
app.use(cors());
app.use(express.json());

// Variáveis globais
let db = null;
let client = null;

// Conectar ao MongoDB
async function connectToMongoDB() {
  try {
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Conexão estabelecida com sucesso!');
    db = client.db(DB_NAME);
    return true;
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    return false;
  }
}

// Rota principal
app.get('/', (req, res) => {
  res.send(`
    <h1>API de Teste - MongoDB</h1>
    <ul>
      <li><a href="/api/numeros">/api/numeros</a> - Listar números recentes</li>
      <li><a href="/api/roletas">/api/roletas</a> - Listar roletas disponíveis</li>
      <li><a href="/api/status">/api/status</a> - Verificar status do MongoDB</li>
    </ul>
  `);
});

// Rota para listar números recentes
app.get('/api/numeros', async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Banco de dados não conectado' });
  }
  
  try {
    const collection = db.collection('roleta_numeros');
    const count = await collection.countDocuments();
    
    if (count === 0) {
      return res.json({ total: 0, data: [] });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;
    
    const numeros = await collection
      .find({})
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    return res.json({
      total: count,
      limit,
      skip,
      data: numeros
    });
  } catch (error) {
    console.error('Erro ao buscar números:', error);
    res.status(500).json({ error: 'Erro interno ao buscar números' });
  }
});

// Rota para listar roletas disponíveis
app.get('/api/roletas', async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Banco de dados não conectado' });
  }
  
  try {
    const collection = db.collection('roleta_numeros');
    
    const roletas = await collection.aggregate([
      { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
      { $project: { _id: 0, id: 1, nome: "$_id" } },
      { $sort: { nome: 1 } }
    ]).toArray();
    
    return res.json(roletas);
  } catch (error) {
    console.error('Erro ao buscar roletas:', error);
    res.status(500).json({ error: 'Erro interno ao buscar roletas' });
  }
});

// Rota para verificar status
app.get('/api/status', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        connected: false,
        message: 'Banco de dados não conectado'
      });
    }
    
    const collections = await db.listCollections().toArray();
    const collectionsInfo = {};
    
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      collectionsInfo[col.name] = count;
    }
    
    return res.json({
      connected: true,
      database: DB_NAME,
      collections: collectionsInfo,
      connection: {
        uri: MONGODB_URI.replace(/:.*@/, ':****@')
      }
    });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ error: 'Erro interno ao verificar status' });
  }
});

// Iniciar servidor
async function startServer() {
  // Conectar ao MongoDB
  const connected = await connectToMongoDB();
  
  if (!connected) {
    console.error('Falha ao conectar ao MongoDB. O servidor será iniciado, mas algumas funcionalidades podem não funcionar.');
  }
  
  // Iniciar servidor HTTP
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

// Iniciar aplicação
startServer(); 