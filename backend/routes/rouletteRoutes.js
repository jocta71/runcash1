/**
 * Rotas para dados de roletas
 * Implementa diferentes níveis de acesso baseados em assinatura
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { authenticate } = require('../middlewares/authMiddleware');
const subscriptionMiddleware = require('../middlewares/unifiedSubscriptionMiddleware');

// Importar controller
const rouletteController = require('../controllers/rouletteController');

/**
 * @route   GET /api/roulettes/sample
 * @desc    Fornece uma amostra de dados para usuários sem plano
 * @access  Público
 */
router.get('/roulettes/sample', (req, res, next) => {
  console.log('[DEBUG] Rota /api/roulettes/sample acessada');
  console.log('[DEBUG] Parâmetros:', req.params);
  console.log('[DEBUG] Query:', req.query);
  return rouletteController.getSampleRoulettes(req, res, next);
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

module.exports = router; 