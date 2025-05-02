/**
 * Rotas para dados de roletas
 * Implementa diferentes níveis de acesso baseados em assinatura
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { verifyTokenAndSubscription, requireResourceAccess } = require('../middlewares/asaasAuthMiddleware');

// Importar controller
const rouletteController = require('../controllers/rouletteController');

/**
 * @route   GET /api/roulettes
 * @desc    Lista todas as roletas disponíveis (limitado por plano)
 * @access  Privado - Requer assinatura ativa
 */
router.get('/roulettes', 
  verifyTokenAndSubscription({ 
    required: true,
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM']
  }),
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
  verifyTokenAndSubscription({ required: false }), // Autenticação opcional
  rouletteController.getRecentNumbers
);

/**
 * @route   GET /api/roulettes/:id/detailed
 * @desc    Obtém dados detalhados da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/detailed', 
  verifyTokenAndSubscription({ 
    required: true,
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM']
  }),
  requireResourceAccess('standard_stats'),
  rouletteController.getDetailedRouletteData
);

/**
 * @route   GET /api/roulettes/:id/stats
 * @desc    Obtém estatísticas detalhadas da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/stats', 
  verifyTokenAndSubscription({
    required: true,
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM']
  }),
  requireResourceAccess('standard_stats'),
  rouletteController.getRouletteStatistics
);

/**
 * @route   GET /api/roulettes/:id/historical
 * @desc    Obtém dados históricos avançados (para assinantes premium)
 * @access  Privado - Requer assinatura premium
 */
router.get('/roulettes/:id/historical', 
  verifyTokenAndSubscription({ 
    required: true,
    allowedPlans: ['PREMIUM']
  }),
  requireResourceAccess('historical_data'),
  rouletteController.getHistoricalData
);

/**
 * @route   GET /api/roulettes/:id/batch
 * @desc    Obtém lote de números (últimos 1000) - requer assinatura
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/batch', 
  verifyTokenAndSubscription({
    required: true,
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM']
  }),
  requireResourceAccess('standard_stats'),
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