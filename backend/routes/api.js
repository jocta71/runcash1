const express = require('express');
const router = express.Router();
const path = require('path');

// Importar o manipulador de redirecionamento de webhook
let webhookRedirector;
try {
  webhookRedirector = require('../api/payment/asaas-webhook-handler');
} catch (err) {
  console.warn('Aviso: Manipulador de redirecionamento de webhook não encontrado');
  // Criar um manipulador padrão caso o arquivo não exista
  webhookRedirector = (req, res) => {
    res.status(200).json({
      message: "Webhook endpoint obsoleto. Atualize para a nova URL",
      status: "deprecated"
    });
  };
}

// Rota para redirecionamento de webhook
router.all('/asaas-webhook', (req, res) => {
  console.log('[API] Redirecionando webhook recebido na URL antiga');
  return webhookRedirector(req, res);
});

// Rota de status para verificações de saúde
router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'api-gateway'
  });
});

// Exportar o router
module.exports = router; 