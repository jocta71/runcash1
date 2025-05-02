/**
 * Rotas para gerenciamento de assinaturas
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/authMiddleware');

// Verificar planos disponíveis (público)
router.get('/plans', subscriptionController.listPlans);

// Rotas que requerem autenticação
router.use(authMiddleware);

// Criar checkout para um plano
router.post('/checkout', subscriptionController.createCheckout);

// Verificar status da assinatura atual
router.get('/status', subscriptionController.checkSubscriptionStatus);

// Cancelar assinatura
router.post('/cancel', subscriptionController.cancelSubscription);

// Webhook do Asaas (esta rota NÃO usa authMiddleware)
router.post('/asaas/webhook', express.json(), subscriptionController.handleAsaasWebhook);

module.exports = router; 