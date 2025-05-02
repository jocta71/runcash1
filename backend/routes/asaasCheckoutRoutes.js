/**
 * Rotas para o Checkout Asaas
 * Implementa endpoints para criação de checkout para assinaturas
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const asaasCheckoutController = require('../controllers/asaasCheckoutController');

/**
 * @route   POST /api/checkout/subscription
 * @desc    Cria um checkout do Asaas para assinatura
 * @access  Privado - Requer autenticação
 */
router.post('/checkout/subscription',
  verifyToken,
  asaasCheckoutController.createSubscriptionCheckout
);

/**
 * @route   GET /api/checkout/:checkoutId/status
 * @desc    Verifica o status de um checkout
 * @access  Privado - Requer autenticação
 */
router.get('/checkout/:checkoutId/status',
  verifyToken,
  asaasCheckoutController.getCheckoutStatus
);

module.exports = router; 