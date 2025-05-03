/**
 * Rotas para receber webhooks de serviços externos
 */

const express = require('express');
const router = express.Router();
const { processAsaasWebhook } = require('../middlewares/asaasWebhookMiddleware');

/**
 * @route   POST /webhooks/asaas
 * @desc    Recebe webhooks do Asaas
 * @access  Public
 */
router.post('/asaas', processAsaasWebhook);

/**
 * @route   GET /webhooks/asaas/status
 * @desc    Verifica se o endpoint de webhooks está funcionando
 * @access  Public
 */
router.get('/asaas/status', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Webhook endpoint está ativo e pronto para receber eventos',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 