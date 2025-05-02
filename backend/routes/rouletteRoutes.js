/**
 * Rotas para dados de roletas
 * Implementa diferentes níveis de acesso baseados em assinatura
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { verifyToken } = require('../middlewares/authMiddleware');
const { checkActiveSubscription, addSubscriptionInfo } = require('../middlewares/subscriptionMiddleware');

// Importar controller
const rouletteController = require('../controllers/rouletteController');

/**
 * @route   GET /api/roulettes
 * @desc    Lista todas as roletas disponíveis (limitado por plano)
 * @access  Público com limitações
 */
router.get('/roulettes', 
  verifyToken, // Autenticação
  addSubscriptionInfo, // Adiciona info de assinatura, mas não bloqueia
  rouletteController.listRoulettes
);

/**
 * @route   GET /api/roulettes/premium
 * @desc    Lista todas as roletas disponíveis (acesso premium)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/premium', 
  verifyToken, // Autenticação
  checkActiveSubscription, // Verifica assinatura ativa
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
  verifyToken, // Autenticação
  addSubscriptionInfo, // Adiciona info de assinatura, mas não bloqueia
  rouletteController.getRecentNumbers
);

/**
 * @route   GET /api/roulettes/:id/detailed
 * @desc    Obtém dados detalhados da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/detailed', 
  verifyToken, // Autenticação
  checkActiveSubscription, // Verifica assinatura ativa
  rouletteController.getDetailedRouletteData
);

/**
 * @route   GET /api/roulettes/:id/stats
 * @desc    Obtém estatísticas detalhadas da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/stats', 
  verifyToken, // Autenticação
  checkActiveSubscription, // Verifica assinatura ativa
  rouletteController.getRouletteStatistics
);

/**
 * @route   GET /api/roulettes/:id/historical
 * @desc    Obtém dados históricos avançados (para assinantes premium)
 * @access  Privado - Requer assinatura premium
 */
router.get('/roulettes/:id/historical', 
  verifyToken, // Autenticação
  checkActiveSubscription, // Verifica assinatura ativa
  // Verificar se o plano do usuário é premium (adicional)
  (req, res, next) => {
    if (req.userPlan && req.userPlan.type === 'PREMIUM') {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Este recurso requer uma assinatura premium',
      code: 'PREMIUM_REQUIRED'
    });
  },
  rouletteController.getHistoricalData
);

/**
 * @route   GET /api/roulettes/:id/batch
 * @desc    Obtém lote de números (últimos 1000) - requer assinatura
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/batch', 
  verifyToken, // Autenticação
  checkActiveSubscription, // Verifica assinatura ativa
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