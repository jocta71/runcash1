/**
 * API de Histórico de Roletas
 * Gerencia acesso ao histórico de números das roletas
 * Provê endpoints para consulta de até 1000 números históricos
 */

const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// Middleware para verificar se o MongoDB está disponível
const checkMongoDB = (req, res, next) => {
  if (!req.app.locals.db) {
    return res.status(503).json({ 
      error: 'Banco de dados não disponível', 
      message: 'O serviço de banco de dados não está acessível no momento' 
    });
  }
  next();
};

/**
 * @route   GET /api/roulettes/history/:rouletteName
 * @desc    Obtém até 1000 números históricos de uma roleta pelo nome
 * @access  Public
 */
router.get('/:rouletteName', checkMongoDB, async (req, res) => {
  try {
    const { rouletteName } = req.params;
    const db = req.app.locals.db;
    
    if (!rouletteName) {
      return res.status(400).json({ 
        error: 'Parâmetro inválido', 
        message: 'O nome da roleta é obrigatório' 
      });
    }
    
    console.log(`[API] Buscando histórico para roleta: ${rouletteName}`);
    
    // Buscar primeiro na coleção roulette_history pelo nome
    const historyDoc = await db.collection('roulette_history').findOne(
      { roletaNome: { $regex: new RegExp(rouletteName, 'i') } }
    );
    
    if (historyDoc && historyDoc.numeros && historyDoc.numeros.length > 0) {
      console.log(`[API] Encontrados ${historyDoc.numeros.length} números no histórico para ${rouletteName}`);
      
      // Extrair apenas os números (sem timestamps) para simplificar a resposta
      const numerosSimples = historyDoc.numeros.map(item => item.numero);
      
      return res.json(numerosSimples);
    }
    
    // Se não encontrou na coleção específica, buscar na coleção de roletas
    console.log(`[API] Histórico não encontrado na coleção principal, buscando na coleção de roletas`);
    
    // Tentar encontrar a roleta pelo nome
    const roleta = await db.collection('roletas').findOne(
      { $or: [
        { nome: { $regex: new RegExp(rouletteName, 'i') } },
        { name: { $regex: new RegExp(rouletteName, 'i') } }
      ]}
    );
    
    // Se não encontrou na coleção 'roletas', tentar na coleção 'roulettes'
    let roletaId = null;
    if (!roleta) {
      const roleta2 = await db.collection('roulettes').findOne(
        { $or: [
          { nome: { $regex: new RegExp(rouletteName, 'i') } },
          { name: { $regex: new RegExp(rouletteName, 'i') } }
        ]}
      );
      
      if (roleta2) {
        roletaId = roleta2.id || roleta2._id;
      }
    } else {
      roletaId = roleta.id || roleta._id;
    }
    
    if (!roletaId) {
      console.log(`[API] Roleta '${rouletteName}' não encontrada em nenhuma coleção`);
      return res.json([]);
    }
    
    // Buscar números na coleção de números
    console.log(`[API] Buscando números para roleta ID: ${roletaId}`);
    
    const numeros = await db.collection('roleta_numeros')
      .find({ roleta_id: roletaId.toString() })
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();
    
    if (numeros && numeros.length > 0) {
      console.log(`[API] Encontrados ${numeros.length} números para roleta ${rouletteName}`);
      
      // Extrair apenas os números
      const numerosSimples = numeros.map(item => item.numero);
      
      return res.json(numerosSimples);
    }
    
    // Se não encontrou nada, retornar array vazio
    console.log(`[API] Nenhum número encontrado para roleta ${rouletteName}`);
    return res.json([]);
    
  } catch (error) {
    console.error('[API] Erro ao buscar histórico da roleta:', error);
    res.status(500).json({ 
      error: 'Erro interno', 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/roulettes/history
 * @desc    Obtém informações sobre o histórico disponível
 * @access  Public
 */
router.get('/', checkMongoDB, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Contar documentos nas coleções relevantes
    const historyCount = await db.collection('roulette_history').countDocuments();
    const roletasCount = await db.collection('roletas').countDocuments();
    const roulettesCount = await db.collection('roulettes').countDocuments();
    const numerosCount = await db.collection('roleta_numeros').countDocuments();
    
    res.json({
      status: 'disponível',
      colecoes: {
        roulette_history: historyCount,
        roletas: roletasCount,
        roulettes: roulettesCount,
        roleta_numeros: numerosCount
      },
      message: 'Use a rota /api/roulettes/history/:rouletteName para obter o histórico específico de uma roleta'
    });
    
  } catch (error) {
    console.error('[API] Erro ao verificar status do histórico:', error);
    res.status(500).json({ 
      error: 'Erro interno', 
      message: error.message 
    });
  }
});

module.exports = router; 