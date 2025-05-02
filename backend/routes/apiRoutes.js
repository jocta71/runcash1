const express = require('express');
const router = express.Router();

// Controladores
const userController = require('../controllers/userController');
const planController = require('../controllers/planController');
const rouletteController = require('../controllers/rouletteController');
const webhookController = require('../controllers/webhookController');

// Middlewares
const authMiddleware = require('../middlewares/authMiddleware');
const subscriptionMiddleware = require('../middlewares/subscriptionMiddleware');

// Rotas de autenticação
router.post('/auth/register', userController.register);
router.post('/auth/login', userController.login);
router.get('/auth/profile', authMiddleware, userController.getProfile);

// Rotas de planos e assinaturas
router.get('/plans', planController.getPlans);
router.post('/subscriptions/create', authMiddleware, planController.createSubscription);
router.get('/subscriptions/status', authMiddleware, planController.getSubscriptionStatus);

// Rotas de Webhooks
router.post('/webhooks/asaas', webhookController.handleAsaasWebhook);

// Rotas de roletas - para todos
router.get('/roulettes/preview', rouletteController.getRoulettePreview);

// Rotas de roletas - protegidas por assinatura
router.get('/roulettes', authMiddleware, subscriptionMiddleware, rouletteController.listAllRoulettes);

// Rota padrão de resposta para API
router.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'API RunCash v1.0',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 