/**
 * Router centralizado para reduzir o número de funções serverless
 * Resolve o limite de 12 funções no plano Hobby da Vercel
 */

// Importações necessárias
const asaasWebhookHandler = require('./asaas-webhook');
const hublaWebhookHandler = require('./hubla-webhook');
const asaasCreateCustomerHandler = require('./payment/asaas-create-customer');
const asaasCreateSubscriptionHandler = require('./payment/asaas-create-subscription');
const simulateWebhookHandler = require('./simulate-webhook');

/**
 * Função principal de roteamento
 */
module.exports = async (req, res) => {
  // Configuração CORS global
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Responder a requisições preflight OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extrair o caminho da API a partir da URL
  // O formato esperado é /api/router/ENDPOINT
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  
  // O primeiro segmento após /api/router/ é o endpoint desejado
  const endpoint = pathSegments.length > 1 ? pathSegments[1] : '';
  
  console.log(`[ROUTER] Requisição recebida para endpoint: ${endpoint}`);
  console.log(`[ROUTER] Método: ${req.method}`);
  console.log(`[ROUTER] URL completa: ${req.url}`);

  // Roteamento baseado no endpoint
  try {
    switch (endpoint) {
      case 'asaas-webhook':
        return await asaasWebhookHandler(req, res);

      case 'hubla-webhook':
        return await hublaWebhookHandler(req, res);
        
      case 'asaas-create-customer':
        return await asaasCreateCustomerHandler(req, res);
        
      case 'asaas-create-subscription':
        return await asaasCreateSubscriptionHandler(req, res);
        
      case 'simulate-webhook':
        return await simulateWebhookHandler(req, res);

      case 'test':
        // Endpoint simples para teste
        return res.status(200).json({ 
          message: 'API Router funcionando corretamente',
          endpoint: endpoint,
          method: req.method,
          timestamp: new Date().toISOString()
        });

      default:
        console.error(`[ROUTER] Endpoint não encontrado: ${endpoint}`);
        return res.status(404).json({ 
          error: 'Endpoint não encontrado',
          message: `O endpoint '${endpoint}' não está configurado no router` 
        });
    }
  } catch (error) {
    console.error(`[ROUTER] Erro ao processar requisição:`, error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor', 
      message: error.message
    });
  }
}; 