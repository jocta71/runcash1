const express = require('express');
const app = express();

// Adicionar o pacote http-proxy-middleware para criar o proxy
const { createProxyMiddleware } = require('http-proxy-middleware');

// Configuração do servidor unificado
console.log('[Server] Endpoints disponíveis:');
console.log('- / (status do servidor)');
console.log('- /api (rotas da API principal)');

// Adicionar proxy para o serviço de assinaturas
const SUBSCRIPTION_SERVICE_URL = process.env.SUBSCRIPTION_SERVICE_URL || 'https://asaas-subscription-service-production.up.railway.app';
console.log(`- /api/subscription (proxy para serviço de assinaturas: ${SUBSCRIPTION_SERVICE_URL})`);

// Configurar proxy para redirecionar requisições para o serviço de assinaturas
app.use('/api/subscription', createProxyMiddleware({
  target: SUBSCRIPTION_SERVICE_URL,
  pathRewrite: {
    '^/api/subscription': '/api/subscription'
  },
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    // Adicionar cabeçalho de autenticação para o serviço de assinaturas
    proxyReq.setHeader('x-api-key', process.env.MAIN_API_KEY || 'default-api-key');
    
    // Preservar o usuário autenticado
    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user._id);
    }
    
    console.log(`[Proxy] Redirecionando ${req.method} ${req.path} para o serviço de assinaturas`);
  },
  onError: (err, req, res) => {
    console.error('[Proxy] Erro ao conectar com o serviço de assinaturas:', err);
    res.status(503).json({
      success: false,
      message: 'Serviço de assinaturas indisponível no momento. Tente novamente mais tarde.'
    });
  }
}));

// ... existing code ... 