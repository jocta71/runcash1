/**
 * Rotas para webhooks do Asaas
 * Implementação seguindo recomendações da documentação Asaas
 */

const express = require('express');
const router = express.Router();
const { processWebhook } = require('../controllers/asaasWebhookController');
const asaasWebhookAuth = require('../middlewares/asaasWebhookAuthMiddleware');

/**
 * Middleware de Log para debug dos webhooks
 * Útil para identificar problemas com Headers ou Payload
 */
const webhookLogMiddleware = (req, res, next) => {
  console.log('\n[Asaas Webhook] Recebida nova requisição:');
  console.log('-- Headers:', JSON.stringify(req.headers, null, 2));
  console.log('-- Método:', req.method);
  console.log('-- Path:', req.path);
  console.log('-- Query:', JSON.stringify(req.query, null, 2));
  console.log('-- Body:', JSON.stringify(req.body, null, 2));
  next();
};

/**
 * Middleware para tratamento de erros específico para webhooks
 * Garantindo que sempre retornamos 200 para o Asaas
 */
const webhookErrorHandler = (err, req, res, next) => {
  console.error('[Asaas Webhook] Erro:', err);
  
  // Sempre retornar 200 para evitar que o Asaas pause a fila
  res.status(200).json({
    received: true,
    processed: false,
    error: err.message || 'Erro interno'
  });
};

/**
 * Rota principal para receber webhooks do Asaas
 * POST /api/webhooks/asaas
 */
router.post('/', 
  express.json(), 
  webhookLogMiddleware,
  asaasWebhookAuth({ checkToken: true, checkIp: false }),
  processWebhook
);

/**
 * Rota para verificar o status do webhook (healthcheck)
 * GET /api/webhooks/asaas/status
 */
router.get('/status', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    message: 'Webhook endpoint está ativo e recebendo eventos'
  });
});

// Aplicar handler de erros
router.use(webhookErrorHandler);

module.exports = router; 