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
    // Conectar ao MongoDB
    const client = new MongoClient(process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash");
    await client.connect();
    
    // Selecionar banco de dados e coleção
    const db = client.db(process.env.ROLETAS_MONGODB_DB_NAME || 'roletas_db');
    const collection = db.collection('metadados_roletas');
    
    // Buscar todos os metadados
    const metadados = await collection.find({}).toArray();
    
    // Fechar conexão
    await client.close();
    
    // Retornar metadados
    return res.json({
      error: false,
      data: metadados
    });
  } catch (error) {
    console.error("Erro ao buscar metadados das roletas:", error);
    return res.status(500).json({
      error: true,
      message: "Erro ao buscar metadados das roletas",
      details: error.message
    });
  }
};

// Endpoint com suporte para parâmetro de operação
router.get('/', (req, res) => {
  const operation = req.query.operation;
  
  switch (operation) {
    case 'metadados':
      return getRouletteMetadata(req, res);
    default:
      return res.status(400).json({
        error: true,
        message: "Operação inválida ou não especificada"
      });
  }
});

// Mantém o endpoint original também para compatibilidade
router.get('/metadados/roletas', getRouletteMetadata);

module.exports = router; 