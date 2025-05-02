/**
 * Rotas para webhooks do Asaas
 */

const express = require('express');
const router = express.Router();

// Importar controller
const asaasWebhookController = require('../controllers/asaasWebhookController');

/**
 * @route   POST /api/webhooks/asaas
 * @desc    Recebe webhooks do Asaas
 * @access  Público (com token de segurança no futuro)
 */
router.post('/webhooks/asaas', asaasWebhookController.processWebhook);

module.exports = router; 