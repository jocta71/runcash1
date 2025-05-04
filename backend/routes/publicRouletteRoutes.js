/**
 * Rotas públicas de roleta com dados criptografados
 * Permite acesso público com dados protegidos por criptografia
 */

const express = require('express');
const router = express.Router();
const getDb = require('../services/database');
const { encryptData } = require('../utils/cryptoService');
const rouletteController = require('../controllers/rouletteController');

// Cache simples para reduzir consultas ao banco
const cache = {
  roulettes: {
    data: null,
    timestamp: 0,
    ttl: 60 * 1000 // 1 minuto
  }
};

/**
 * @route   GET /api/public/roulettes
 * @desc    Lista todas as roletas disponíveis com dados criptografados
 * @access  Público
 */
router.get('/roulettes', async (req, res) => {
  try {
    // Gerar identificador de request para rastreamento
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[API-PUBLIC ${requestId}] Requisição recebida para /api/public/roulettes`);
    
    // Verificar se temos dados em cache válidos
    const now = Date.now();
    if (cache.roulettes.data && now - cache.roulettes.timestamp < cache.roulettes.ttl) {
      console.log(`[API-PUBLIC ${requestId}] Retornando dados de cache`);
      return res.json(cache.roulettes.data);
    }
    
    // Não temos cache válido, buscar dados do banco
    const db = await getDb();
    const roulettes = await db.collection('roulettes').find({}).toArray();
    
    // Processar dados (simplificados para todos os usuários)
    const processedData = roulettes.map(roulette => ({
      id: roulette._id.toString(),
      name: roulette.name,
      provider: roulette.provider,
      status: roulette.status
    }));
    
    // Criptografar dados
    const encryptedData = encryptData(processedData);
    
    // Construir resposta
    const response = {
      success: true,
      timestamp: now,
      data: encryptedData
    };
    
    // Atualizar cache
    cache.roulettes.data = response;
    cache.roulettes.timestamp = now;
    
    console.log(`[API-PUBLIC ${requestId}] Dados criptografados e enviados`);
    return res.json(response);
  } catch (error) {
    console.error('Erro ao listar roletas públicas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter lista de roletas',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route   GET /api/public/roulettes/:id
 * @desc    Obtém dados de uma roleta específica com dados criptografados
 * @access  Público
 */
router.get('/roulettes/:id', async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[API-PUBLIC ${requestId}] Buscando dados da roleta ${rouletteId}`);
    
    // Buscar roleta do banco
    const db = await getDb();
    const roulette = await db.collection('roulettes').findOne({
      $or: [
        { _id: require('mongodb').ObjectId.isValid(rouletteId) ? new require('mongodb').ObjectId(rouletteId) : null },
        { id: rouletteId }
      ]
    });
    
    if (!roulette) {
      return res.status(404).json({
        success: false,
        message: 'Roleta não encontrada'
      });
    }
    
    // Buscar apenas os últimos 10 números para versão pública
    const numbers = await db.collection('roulette_numbers')
      .find({ rouletteId: roulette._id.toString() })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    
    // Processar dados
    const processedData = {
      id: roulette._id.toString(),
      name: roulette.name,
      provider: roulette.provider,
      status: roulette.status,
      numbers: numbers.map(n => ({
        number: n.number,
        timestamp: n.timestamp,
        color: n.color || getNumberColor(n.number)
      }))
    };
    
    // Criptografar dados
    const encryptedData = encryptData(processedData);
    
    // Retornar resposta criptografada
    return res.json({
      success: true,
      timestamp: Date.now(),
      data: encryptedData
    });
  } catch (error) {
    console.error('Erro ao obter dados da roleta:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter dados da roleta',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * Determina a cor do número da roleta
 */
function getNumberColor(number) {
  if (number === 0) return 'green';
  
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(number) ? 'red' : 'black';
}

module.exports = router; 