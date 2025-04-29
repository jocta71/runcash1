const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

// Rota para criar cliente no Asaas (protegida)
router.post('/customer', protect, subscriptionController.createCustomer);

// Rota para criar assinatura (protegida)
router.post('/', protect, subscriptionController.createSubscription);

// Rota para obter status da assinatura (protegida)
router.get('/status', protect, subscriptionController.getSubscriptionStatus);

// Rota para cancelar assinatura (protegida)
router.post('/cancel', protect, subscriptionController.cancelSubscription);

module.exports = router; 