/**
 * Rotas para gerenciamento de assinaturas
 * Inclui verificação de status, gerenciamento de planos e webhooks
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { verifyTokenAndSubscription } = require('../middlewares/asaasAuthMiddleware');

// Importar controllers
const { getSubscriptionStatus } = require('../api/subscription/status');
const { 
  createCheckout, 
  handleWebhook, 
  cancelSubscription, 
  listUserSubscriptions,
  listPlans 
} = require('../controllers/subscriptionController');

/**
 * @route   GET /api/subscription/status
 * @desc    Verifica status da assinatura do usuário
 * @access  Privado - Requer autenticação
 */
router.get('/status', protect, getSubscriptionStatus);

/**
 * @route   GET /api/subscriptions/plans
 * @desc    Lista planos disponíveis para assinatura
 * @access  Público - Não requer autenticação
 */
router.get('/plans', listPlans);

/**
 * @route   POST /api/subscriptions/checkout
 * @desc    Cria um checkout de assinatura no Asaas
 * @access  Privado - Requer autenticação
 */
router.post('/checkout', protect, createCheckout);

/**
 * @route   POST /api/subscriptions/webhook
 * @desc    Recebe eventos de webhook do Asaas
 * @access  Público - Não requer autenticação
 */
router.post('/webhook', handleWebhook);

/**
 * @route   POST /api/subscriptions/cancel
 * @desc    Cancela uma assinatura ativa
 * @access  Privado - Requer autenticação
 */
router.post('/cancel', protect, cancelSubscription);

/**
 * @route   GET /api/subscriptions
 * @desc    Lista assinaturas do usuário atual
 * @access  Privado - Requer autenticação
 */
router.get('/', protect, listUserSubscriptions);

module.exports = router; 