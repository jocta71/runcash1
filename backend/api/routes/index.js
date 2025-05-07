const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// Rota para obter metadados das roletas
router.get('/metadados-roletas', async (req, res) => {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db(process.env.ROLETAS_MONGODB_DB_NAME || 'roletas_db');
    
    // Buscar todos os metadados de roletas
    const metadados = await db.collection('metadados').find({}).project({ 
      roleta_id: 1, 
      roleta_nome: 1, 
      _id: 0 
    }).toArray();
    
    await client.close();
    
    return res.json({
      error: false,
      data: metadados
    });
  } catch (error) {
    console.error('Erro ao buscar metadados de roletas:', error);
    return res.status(500).json({
      error: true,
      message: 'Erro ao buscar metadados de roletas'
    });
  }
});

// Rota padrão para verificação de API
router.get('/', (req, res) => {
  res.json({
    error: false,
    message: 'API funcionando corretamente'
  });
});

module.exports = router; 