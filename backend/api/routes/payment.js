const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { paymentApiLimiter, paymentCreationLimiter, webhookLimiter } = require('../middleware/rateLimiter');

// Importar controladores
const asaasWebhook = require('../payment/asaas-webhook');
const asaasCreateSubscription = require('../payment/asaas-create-subscription');
const asaasCreateCustomer = require('../payment/asaas-create-customer');
const asaasFindPayment = require('../payment/asaas-find-payment');
const asaasPixQrcode = require('../payment/asaas-pix-qrcode');

// Webhook do Asaas (sem autenticação, mas com limitação de taxa)
router.post('/webhook', webhookLimiter, asaasWebhook);

// Rotas protegidas (requerem autenticação)
// Criação de assinatura (com proteção e limite rigoroso)
router.post('/subscription', protect, paymentCreationLimiter, asaasCreateSubscription);

// Criação de cliente (com proteção e limite normal)
router.post('/customer', protect, paymentApiLimiter, asaasCreateCustomer);

// Busca de pagamento (com proteção e limite normal)
router.get('/payment', protect, paymentApiLimiter, asaasFindPayment);

// Geração de QR Code PIX (com proteção e limite normal)
router.get('/pix-qrcode', protect, paymentApiLimiter, asaasPixQrcode);

module.exports = router; 