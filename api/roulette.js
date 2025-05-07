const express = require('express');
const router = express.Router();
const cors = require('cors');
const { MongoClient } = require('mongodb');

// Middleware para CORS
router.use(cors());
router.use(express.json());

// Handler para metadados das roletas
const getRouletteMetadata = async (req, res) => {
  try {
    // Log para debug
    console.log('Requisição para metadados das roletas recebida');
    console.log('Query params:', req.query);
    
    // Conectar ao MongoDB
    const uri = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
    const dbName = process.env.ROLETAS_MONGODB_DB_NAME || 'roletas_db';
    
    console.log(`Conectando ao MongoDB: ${uri}, DB: ${dbName}`);
    
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    await client.connect();
    console.log('Conexão com MongoDB estabelecida');
    
    // Selecionar banco de dados e coleção
    const db = client.db(dbName);
    const collection = db.collection('metadados_roletas');
    
    // Buscar todos os metadados
    console.log('Buscando metadados das roletas');
    const metadados = await collection.find({}).toArray();
    console.log(`${metadados.length} metadados encontrados`);
    
    // Fechar conexão
    await client.close();
    console.log('Conexão com MongoDB fechada');
    
    // Retornar metadados
    return res.status(200).json({
      error: false,
      data: metadados
    });
  } catch (error) {
    console.error("Erro ao buscar metadados das roletas:", error);
    
    // Resposta mais detalhada para ajudar na depuração
    return res.status(500).json({
      error: true,
      message: "Erro ao buscar metadados das roletas",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Endpoint principal com suporte para parâmetro de operação e tratamento de URL duplicada
router.get('/', (req, res) => {
  // Tentar obter operação da query ou da URL
  let operation = req.query.operation;
  
  // Log para debug
  console.log('Requisição recebida na rota principal de roletas');
  console.log('Método:', req.method);
  console.log('Operation:', operation);
  console.log('Query completa:', req.query);
  console.log('URL original:', req.originalUrl);
  
  // Verificar se a URL contém /api/api/ (URL duplicada)
  if (req.originalUrl.includes('/api/api/') && req.originalUrl.includes('metadados/roletas')) {
    console.log('URL duplicada detectada, forçando operação para "metadados"');
    operation = 'metadados';
  }
  
  // Se a URL termina com /metadados/roletas, é um caso especial
  if (req.originalUrl.endsWith('/metadados/roletas')) {
    console.log('URL de metadados das roletas detectada');
    operation = 'metadados';
  }
  
  switch (operation) {
    case 'metadados':
      return getRouletteMetadata(req, res);
    default:
      return res.status(400).json({
        error: true,
        message: "Operação inválida ou não especificada",
        availableOperations: ['metadados']
      });
  }
});

// Mantém o endpoint original também para compatibilidade
router.get('/metadados/roletas', getRouletteMetadata);

module.exports = router; 