/**
 * Rotas para gerenciamento de assinaturas
 * Inclui verificação de status, gerenciamento de planos e webhooks
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middlewares/authMiddleware');
const subscriptionMiddleware = require('../middlewares/subscriptionMiddleware');

// Rotas públicas
router.get('/plans', subscriptionController.listPlans);

// Rotas que exigem autenticação
router.post('/create', authMiddleware.verifyToken, subscriptionController.createSubscription);
router.get('/status', authMiddleware.verifyToken, subscriptionMiddleware.checkSubscription, subscriptionController.checkUserSubscription);

// Webhook do Asaas (sem autenticação - usado pelo Asaas)
router.post('/webhook/asaas', express.json(), subscriptionController.processWebhook);

module.exports = router; 