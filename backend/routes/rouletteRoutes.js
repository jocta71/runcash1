/**
 * Rotas para dados de roletas
 * Implementa diferentes níveis de acesso baseados em assinatura
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { authenticate } = require('../middlewares/authMiddleware');
const subscriptionMiddleware = require('../middlewares/unifiedSubscriptionMiddleware');
const { controlDataAccess, filterDataByAccessLevel } = require('../middlewares/dataAccessController');
const getDb = require('../services/database');

// Importar controller
const rouletteController = require('../controllers/rouletteController');

/**
 * @route   GET /api/roulettes/sample
 * @desc    Obtém uma amostra limitada de dados de roletas para usuários sem assinatura
 * @access  Público
 */
router.get('/sample', async (req, res) => {
  try {
    const db = await getDb();
    
    // Buscar algumas roletas para fornecer como amostra
    const roulettes = await db.collection('roulettes')
      .find({})
      .limit(3)
      .toArray();
    
    // Limitar os dados retornados
    const limitedData = roulettes.map(roulette => ({
      id: roulette.id,
      nome: roulette.nome || roulette.name,
      status: roulette.status || 'active',
      amostra: true,
      numero: roulette.numero ? roulette.numero.slice(0, 5) : []
    }));
    
    res.status(200).json(limitedData);
  } catch (error) {
    console.error('Erro ao buscar amostras de roletas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar amostras de roletas',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/roulettes
 * @desc    Lista todas as roletas disponíveis (limitado por plano)
 * @access  Público com limitações
 */
router.get('/roulettes', 
  authenticate({ required: false }), // Autenticação opcional
  rouletteController.listRoulettes
);

/**
 * @route   GET /api/roulettes/:id/basic
 * @desc    Obtém dados básicos de uma roleta específica
 * @access  Público
 */
router.get('/roulettes/:id/basic', 
  rouletteController.getBasicRouletteData
);

/**
 * @route   GET /api/roulettes/:id/recent
 * @desc    Obtém números recentes de uma roleta (limitado por plano)
 * @access  Público com limitações
 */
router.get('/roulettes/:id/recent', 
  authenticate({ required: false }), // Autenticação opcional
  rouletteController.getRecentNumbers
);

/**
 * @route   GET /api/roulettes/:id/detailed
 * @desc    Obtém dados detalhados da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/detailed', 
  authenticate({ required: true }),
  subscriptionMiddleware.requireSubscription({ 
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM'],
    resourceType: 'detailed_data'
  }),
  rouletteController.getDetailedRouletteData
);

/**
 * @route   GET /api/roulettes/:id/stats
 * @desc    Obtém estatísticas detalhadas da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/stats', 
  authenticate({ required: true }),
  subscriptionMiddleware.requireSubscription({ 
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM'],
    resourceType: 'roulette_stats'
  }),
  rouletteController.getRouletteStatistics
);

/**
 * @route   GET /api/roulettes/:id/historical
 * @desc    Obtém dados históricos avançados (para assinantes premium)
 * @access  Privado - Requer assinatura premium
 */
router.get('/roulettes/7d3c2c9f-2850-f642-861f-5bb4daf1806a/historical', 
  authenticate({ required: true }),
  subscriptionMiddleware.requireSubscription({ 
    allowedPlans: ['PREMIUM'],
    resourceType: 'historical_data'
  }),
  rouletteController.getHistoricalData
);

/**
 * @route   GET /api/roulettes/:id/batch
 * @desc    Obtém lote de números (últimos 1000) - requer assinatura
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/batch', 
  authenticate({ required: true }),
  subscriptionMiddleware.requireSubscription({ 
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM'],
    resourceType: 'numbers_batch'
  }),
  rouletteController.getNumbersBatch
);

/**
 * @route   GET /api/roulettes/:id/preview
 * @desc    Versão degradada para usuários sem assinatura
 * @access  Público
 */
router.get('/roulettes/:id/preview', 
  rouletteController.getFreePreview
);

/**
 * @route GET /api/roulettes/limits
 * @desc Obter dados recentes das roletas com controle de acesso baseado em assinatura
 * @access Público com dados limitados / Dados completos para assinantes
 */
router.get('/limits', authenticate({required: false}), controlDataAccess, async (req, res) => {
  try {
    // Conectar ao MongoDB
    const db = await getDb();
    
    // Buscar números recentes das roletas
    const result = await db.collection('roleta_numeros')
      .find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    
    if (!result || result.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'Nenhum dado disponível',
        data: [] 
      });
    }
    
    // Agrupar por roleta
    const rouletteMap = {};
    
    result.forEach(item => {
      // Verificar se temos uma entrada para esta roleta
      if (!rouletteMap[item.roleta_id]) {
        rouletteMap[item.roleta_id] = {
          id: item.roleta_id,
          nome: item.roleta_nome || `Roleta ${item.roleta_id}`,
          numero: [],
          status: 'active',
          timestamp: new Date()
        };
      }
      
      // Adicionar número se ainda não temos 30 (ou o limite determinado pelo plano)
      const numeroLimit = req.dataAccessLevel === 'premium' ? 50 : 
                         (req.dataAccessLevel === 'authenticated' ? 10 : 3);
      
      if (rouletteMap[item.roleta_id].numero.length < numeroLimit) {
        rouletteMap[item.roleta_id].numero.push({
          numero: item.numero,
          timestamp: item.timestamp
        });
      }
    });
    
    // Converter para array
    let roulettes = Object.values(rouletteMap);
    
    // Aplicar filtro baseado no nível de acesso
    const filteredData = filterDataByAccessLevel(roulettes, req.dataAccessLevel);
    
    return res.status(200).json({
      success: true,
      access_level: req.dataAccessLevel,
      has_subscription: req.hasActiveSubscription,
      plan_type: req.planType,
      count: filteredData.length,
      timestamp: new Date(),
      data: filteredData
    });
  } catch (error) {
    console.error('Erro ao buscar dados das roletas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados das roletas',
      error: error.message
    });
  }
});

/**
 * @route GET /api/roulettes/:id
 * @desc Obter dados específicos de uma roleta
 * @access Público com dados limitados / Dados completos para assinantes
 */
router.get('/:id', authenticate({required: false}), controlDataAccess, async (req, res) => {
  try {
    const roletaId = req.params.id;
    
    if (!roletaId) {
      return res.status(400).json({
        success: false,
        message: 'ID da roleta não fornecido'
      });
    }
    
    // Conectar ao MongoDB
    const db = await getDb();
    
    // Buscar números da roleta específica
    const result = await db.collection('roleta_numeros')
      .find({ roleta_id: roletaId })
      .sort({ timestamp: -1 })
      .limit(req.dataAccessLevel === 'premium' ? 100 : 10)
      .toArray();
    
    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Roleta não encontrada ou sem dados disponíveis'
      });
    }
    
    // Construir objeto com dados da roleta
    const roulette = {
      id: roletaId,
      nome: result[0].roleta_nome || `Roleta ${roletaId}`,
      numero: result.map(item => ({
        numero: item.numero,
        timestamp: item.timestamp
      })),
      status: 'active',
      timestamp: new Date()
    };
    
    // Aplicar filtro baseado no nível de acesso
    const filteredData = filterDataByAccessLevel(roulette, req.dataAccessLevel);
    
    return res.status(200).json({
      success: true,
      access_level: req.dataAccessLevel,
      has_subscription: req.hasActiveSubscription,
      plan_type: req.planType,
      timestamp: new Date(),
      data: filteredData
    });
  } catch (error) {
    console.error('Erro ao buscar dados da roleta:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados da roleta',
      error: error.message
    });
  }
});

module.exports = router; 