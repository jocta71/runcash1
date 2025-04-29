const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Rota para receber webhooks do Asaas
router.post('/asaas', webhookController.processWebhook);

module.exports = router; 