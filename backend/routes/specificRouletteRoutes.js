/**
 * Rotas específicas para cada roleta individual
 * Implementa endpoints dedicados com ID de roleta na URL
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { authenticate } = require('../middlewares/authMiddleware');
const subscriptionMiddleware = require('../middlewares/unifiedSubscriptionMiddleware');

// Importar controller
const specificRouletteController = require('../controllers/specificRouletteController');

/**
 * @route   GET /api/roulette/:id
 * @desc    Obtém informações básicas de uma roleta específica
 * @access  Público
 */
router.get('/roulette/:id', specificRouletteController.getRouletteById);

/**
 * @route   GET /api/roulette/:id/numbers
 * @desc    Obtém os números recentes de uma roleta específica
 * @access  Público (com limite de quantidade)
 */
router.get('/roulette/:id/numbers', specificRouletteController.getRecentNumbersByRoulette);

/**
 * @route   GET /api/roulette/:id/stats
 * @desc    Obtém estatísticas de uma roleta específica
 * @access  Público (estatísticas básicas) / Privado (estatísticas completas)
 */
router.get('/roulette/:id/stats', 
  authenticate({ required: false }),
  specificRouletteController.getStatsByRoulette
);

/**
 * @route   GET /api/roulette/:id/status
 * @desc    Obtém o status atual da roleta (online/offline, último número, etc)
 * @access  Público
 */
router.get('/roulette/:id/status', specificRouletteController.getRouletteStatus);

/**
 * @route   GET /api/roulette/:id/strategies
 * @desc    Obtém estratégias recomendadas para uma roleta específica
 * @access  Privado - Requer assinatura
 */
router.get('/roulette/:id/strategies',
  authenticate({ required: true }),
  subscriptionMiddleware.requireSubscription({ 
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM'],
    resourceType: 'roulette_strategies'
  }),
  specificRouletteController.getRouletteStrategies
);

module.exports = router; 