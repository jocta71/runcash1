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




// Exportar o router
module.exports = router; 