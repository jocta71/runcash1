const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// Endpoint para obter metadados das roletas
router.get('/metadados/roletas', async (req, res) => {
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
});

module.exports = router; 