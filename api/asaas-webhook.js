/**
 * Handler para o webhook do Asaas (versão simplificada)
 * 
 * Esta versão foca em receber e validar os eventos sem depender
 * da conexão com MongoDB, para diagnosticar e resolver problemas.
 */

// Importar body-parser para processar o corpo da requisição
const bodyParser = require('body-parser');
const express = require('express');

// Criar app Express
const app = express();

// Configurar CORS e middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// Middleware para processar JSON
app.use(express.json());

// Rota para verificação do webhook (GET)
app.get('/', (req, res) => {
  return res.status(200).json({ 
    status: 'Webhook endpoint ativo. Use POST para eventos do Asaas.',
    timestamp: new Date().toISOString() 
  });
});

// Rota para receber eventos (POST)
app.post('/', async (req, res) => {
  try {
    // Log dos headers para debug
    console.log('Headers recebidos:', JSON.stringify(req.headers));
    
    // Obter dados do webhook
    let webhookData = req.body;
    
    // Verificar se o corpo é válido
    if (!webhookData || typeof webhookData !== 'object') {
      console.warn('Corpo da requisição inválido, usando objeto vazio');
      webhookData = {};
    }
    
    // Log do corpo recebido
    console.log('Corpo da requisição processado:', JSON.stringify(webhookData));
    
    // Confirmação de recebimento imediata para evitar timeout
    const response = {
      success: true,
      message: 'Evento recebido com sucesso',
      event: webhookData.event || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    // Registrar evento em log
    const eventType = webhookData.event || 'unknown';
    console.log(`[ASAAS WEBHOOK] Evento ${eventType} recebido e processado`);
    
    // Responder sucesso
    return res.status(200).json(response);
  } catch (error) {
    console.error('[ASAAS WEBHOOK] Erro:', error.message);
    
    // Garantir resposta mesmo com erro
    return res.status(200).json({ 
      success: true,
      error_handled: true,
      message: 'Erro durante processamento, mas evento foi recebido',
      error_message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Handler para o Vercel
module.exports = (req, res) => {
  // Para requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  
  // Encaminhar para o Express
  return app(req, res);
}; 