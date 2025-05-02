/**
 * Rotas para webhooks do Asaas
 */

const express = require('express');
const router = express.Router();
const { processWebhook } = require('../controllers/asaasWebhookController');

/**
 * Rota para receber webhooks do Asaas
 * POST /api/webhooks/asaas
 */
router.post('/', express.json(), processWebhook);

module.exports = router; 