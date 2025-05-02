/**
 * Rotas para webhooks do Asaas
 * Processa eventos de pagamento, assinatura e checkout
 */

const express = require('express');
const router = express.Router();
const asaasWebhookController = require('../controllers/asaasWebhookController');

/**
 * @route   POST /api/webhooks/asaas
 * @desc    Endpoint principal para receber todos os webhooks do Asaas
 * @access  Público (segurança via token no header)
 */
router.post('/webhooks/asaas', 
  express.json({type: 'application/json'}),
  (req, res, next) => {
    // Verificação opcional de token - descomentar se configurado no Asaas
    /*
    const authToken = req.headers['asaas-access-token'];
    const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN;
    
    if (!authToken || authToken !== configuredToken) {
      return res.status(401).json({
        success: false,
        message: 'Token de webhook inválido'
      });
    }
    */
    
    next();
  },
  asaasWebhookController.processWebhook
);

/**
 * @route   POST /api/webhooks/asaas/payments
 * @desc    Endpoint específico para webhooks de pagamentos
 * @access  Público (segurança via token no header)
 */
router.post('/webhooks/asaas/payments',
  express.json({type: 'application/json'}),
  asaasWebhookController.processWebhook
);

/**
 * @route   POST /api/webhooks/asaas/subscriptions
 * @desc    Endpoint específico para webhooks de assinaturas
 * @access  Público (segurança via token no header)
 */
router.post('/webhooks/asaas/subscriptions',
  express.json({type: 'application/json'}),
  asaasWebhookController.processWebhook
);

// Rota que recebe os webhooks do Asaas
router.post('/webhook/asaas', asaasWebhookController.processWebhook);

module.exports = router; 