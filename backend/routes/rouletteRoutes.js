/**
 * Rotas para dados de roletas
 * Implementa diferentes níveis de acesso baseados em assinatura
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { verifyTokenAndSubscription, requireResourceAccess } = require('../middlewares/asaasAuthMiddleware');
const authMiddleware = require('../middleware/auth.middleware');
const subscriptionMiddleware = require('../middleware/subscription.middleware');

// Importar controller
const rouletteController = require('../controllers/rouletteController');

// Aplicar middleware de autenticação e verificação de assinatura em todas as rotas
router.use(authMiddleware);
router.use(subscriptionMiddleware);

/**
 * @route   GET /api/roulettes
 * @desc    Retorna todas as roletas disponíveis
 * @access  Private (requer assinatura ativa)
 */
router.get('/', rouletteController.getAllRoulettes);

/**
 * @route   GET /api/roulettes/:id/basic
 * @desc    Retorna informações básicas de uma roleta específica
 * @access  Private (requer assinatura ativa)
 */
router.get('/:id/basic', rouletteController.getRouletteBasic);

/**
 * @route   GET /api/roulettes/:id/recent
 * @desc    Retorna números recentes de uma roleta específica
 * @access  Private (requer assinatura ativa)
 */
router.get('/:id/recent', rouletteController.getRouletteRecent);

/**
 * @route   GET /api/roulettes/:id/detailed
 * @desc    Retorna informações detalhadas de uma roleta específica
 * @access  Private (requer assinatura ativa)
 */
router.get('/:id/detailed', rouletteController.getRouletteDetailed);

/**
 * @route   GET /api/roulettes/:id/stats
 * @desc    Retorna estatísticas de uma roleta específica
 * @access  Private (requer assinatura ativa)
 */
router.get('/:id/stats', rouletteController.getRouletteStats);

/**
 * @route   GET /api/roulettes/:id/historical
 * @desc    Retorna dados históricos de uma roleta específica
 * @access  Private (requer assinatura ativa)
 */
router.get('/:id/historical', rouletteController.getRouletteHistorical);

/**
 * @route   GET /api/roulettes/:id/batch
 * @desc    Retorna dados em lote para uma roleta específica
 * @access  Private (requer assinatura ativa)
 */
router.get('/:id/batch', rouletteController.getBatchData);

/**
 * @route   GET /api/roulettes/:id/preview
 * @desc    Retorna uma prévia de uma roleta específica (versão limitada)
 * @access  Public (não requer assinatura)
 */
router.get('/:id/preview', (req, res, next) => {
  // Skip subscription check for preview endpoint
  const originalMiddleware = req.subscription;
  next();
  // Restaurar estado original após o endpoint
  req.subscription = originalMiddleware;
}, rouletteController.getRoulettePreview);

module.exports = router; 