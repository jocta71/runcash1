/**
 * Router centralizado para reduzir o número de funções serverless
 * Resolve o limite de 12 funções no plano Hobby da Vercel
 */

// Importações necessárias
const asaasWebhookHandler = require('./asaas-webhook');
const hublaWebhookHandler = require('./hubla-webhook');

// Importação do proxy para roletas
let proxyRouletteHandler;
try {
  proxyRouletteHandler = require('./proxy-roulette');
} catch (error) {
  console.warn('Handler proxy-roulette não disponível:', error.message);
}

// Importação do proxy genérico
let proxyHandler;
try {
  proxyHandler = require('./proxy');
} catch (error) {
  console.warn('Handler proxy genérico não disponível:', error.message);
}

// Importações dos handlers de pagamento
let asaasCreateCustomerHandler;
let asaasCreateSubscriptionHandler;
let createCheckoutSessionHandler;
let simulateWebhookHandler;

// Importações das funções de assinatura
let subscriptionCancelHandler;
let subscriptionCurrentHandler;
let webhookHandler;

// Carregamento dinâmico dos handlers para evitar erros se os arquivos não existirem
try {
  asaasCreateCustomerHandler = require('./payment/asaas-create-customer');
} catch (error) {
  console.warn('Handler payment/asaas-create-customer não disponível:', error.message);
}

try {
  asaasCreateSubscriptionHandler = require('./payment/asaas-create-subscription');
} catch (error) {
  console.warn('Handler payment/asaas-create-subscription não disponível:', error.message);
}

try {
  createCheckoutSessionHandler = require('./payment/create-checkout-session');
} catch (error) {
  console.warn('Handler payment/create-checkout-session não disponível:', error.message);
}

try {
  simulateWebhookHandler = require('./simulate-webhook');
} catch (error) {
  console.warn('Handler simulate-webhook não disponível:', error.message);
}

try {
  subscriptionCancelHandler = require('./subscription/cancel');
} catch (error) {
  console.warn('Handler subscription/cancel não disponível:', error.message);
}

try {
  subscriptionCurrentHandler = require('./subscription/current');
} catch (error) {
  console.warn('Handler subscription/current não disponível:', error.message);
}

try {
  webhookHandler = require('./webhook');
} catch (error) {
  console.warn('Handler webhook não disponível:', error.message);
}

/**
 * Função principal de roteamento
 */
module.exports = async (req, res) => {
  // Configuração CORS global
  res.setHeader('Access-Control-Allow-Credentials', true);
  // Usar a origem específica em vez de wildcard para permitir credenciais
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Responder a requisições preflight OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extrair o caminho da API a partir da URL
  // O formato esperado é /api/router/ENDPOINT ou /api/router/CATEGORY/ENDPOINT
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  
  // Determinar o endpoint baseado nos segmentos do caminho
  const endpoint = pathSegments.length > 1 ? pathSegments[1] : '';
  const subpath = pathSegments.length > 2 ? pathSegments.slice(2).join('/') : '';
  
  console.log(`[ROUTER] Requisição recebida para endpoint: ${endpoint}${subpath ? '/' + subpath : ''}`);
  console.log(`[ROUTER] Método: ${req.method}`);
  console.log(`[ROUTER] URL completa: ${req.url}`);

  // Roteamento baseado no endpoint e subpath
  try {
    const fullPath = subpath ? `${endpoint}/${subpath}` : endpoint;
    
    // Caso especial para ROULETTES (maiúsculo)
    if (endpoint === 'ROULETTES' || endpoint === 'roulettes') {
      return proxyRouletteHandler 
        ? await proxyRouletteHandler(req, res) 
        : notImplemented(res, 'proxy-roulette');
    }
    
    // Caso especial para proxy-roulette
    if (endpoint === 'proxy-roulette') {
      return proxyRouletteHandler 
        ? await proxyRouletteHandler(req, res) 
        : notImplemented(res, 'proxy-roulette');
    }
    
    // Caso especial para proxy genérico
    if (endpoint === 'proxy') {
      return proxyHandler 
        ? await proxyHandler(req, res) 
        : notImplemented(res, 'proxy');
    }
    
    switch (fullPath) {
      // Webhooks
      case 'asaas-webhook':
        return asaasWebhookHandler ? await asaasWebhookHandler(req, res) : notImplemented(res, fullPath);
      
      case 'hubla-webhook':
        return hublaWebhookHandler ? await hublaWebhookHandler(req, res) : notImplemented(res, fullPath);
      
      case 'webhook':
        return webhookHandler ? await webhookHandler(req, res) : notImplemented(res, fullPath);
      
      // Pagamentos
      case 'payment/asaas-create-customer':
      case 'asaas-create-customer':
        return asaasCreateCustomerHandler ? await asaasCreateCustomerHandler(req, res) : notImplemented(res, fullPath);
      
      case 'payment/asaas-create-subscription':
      case 'asaas-create-subscription':
        return asaasCreateSubscriptionHandler ? await asaasCreateSubscriptionHandler(req, res) : notImplemented(res, fullPath);
      
      case 'payment/create-checkout-session':
      case 'create-checkout-session':
        return createCheckoutSessionHandler ? await createCheckoutSessionHandler(req, res) : notImplemented(res, fullPath);
      
      // Simulação
      case 'simulate-webhook':
        return simulateWebhookHandler ? await simulateWebhookHandler(req, res) : notImplemented(res, fullPath);
      
      // Assinaturas
      case 'subscription/cancel':
        return subscriptionCancelHandler ? await subscriptionCancelHandler(req, res) : notImplemented(res, fullPath);
      
      case 'subscription/current':
        return subscriptionCurrentHandler ? await subscriptionCurrentHandler(req, res) : notImplemented(res, fullPath);
      
      // Teste
      case 'test':
        // Endpoint simples para teste
        return res.status(200).json({ 
          message: 'API Router funcionando corretamente',
          endpoint: fullPath,
          method: req.method,
          timestamp: new Date().toISOString()
        });

      default:
        console.error(`[ROUTER] Endpoint não encontrado: ${fullPath}`);
        return res.status(404).json({ 
          error: 'Endpoint não encontrado',
          message: `O endpoint '${fullPath}' não está configurado no router` 
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

// Função auxiliar para endpoints não implementados
function notImplemented(res, endpoint) {
  console.warn(`[ROUTER] Handler para '${endpoint}' não encontrado`);
  return res.status(501).json({ 
    error: 'Não implementado', 
    message: `O handler para o endpoint '${endpoint}' não está disponível`
  });
} 