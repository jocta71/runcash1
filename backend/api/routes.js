/**
 * Configuração central de rotas da API
 * Registra todos os endpoints e middlewares globais
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

// Importar middlewares
const { protect } = require('../middlewares/auth');
const { verifyAsaasSubscription } = require('../middlewares/premiumVerifier');

// Importar controllers
const subscriptionRoutes = require('../routes/subscriptionRoutes');
const { createCheckout } = require('./checkout/create');
const asaasWebhookRoutes = require('../routes/asaasWebhookRoutes');
const { handleAsaasWebhook } = require('../controllers/asaasWebhookHandler');

// Aplicar middleware para todas as rotas
router.use(express.json());

// Rota de health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota principal - informações da API
router.get('/', (req, res) => {
  res.status(200).json({
    name: 'RunCash API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Rotas de autenticação não precisam de proteção
// router.use('/auth', authRoutes);

// Rotas de assinatura
router.use('/subscription', subscriptionRoutes);

// Rota para webhooks do Asaas (sem proteção)
router.use('/webhooks/asaas', asaasWebhookRoutes);

// Rota alternativa para webhook do Asaas (compatibilidade com configurações antigas)
router.use('/asaas-webhook', asaasWebhookRoutes);

// Endpoint específico para webhook do Asaas no formato antigo
router.post('/asaas-webhook', express.json(), handleAsaasWebhook);

// Rota de criação de checkout
router.post('/checkout/create', protect, createCheckout);

// Proxy para a API de roletas - requer assinatura ativa na Asaas
router.get('/roulettes', 
  protect,
  verifyAsaasSubscription({ 
    required: true, 
    allowedPlans: ['BASIC', 'PREMIUM', 'PRO'] 
  }),
  async (req, res) => {
    try {
      // URL alvo protegida
      const targetUrl = 'https://backendapi-production-36b5.up.railway.app/api/roulettes';
      
      console.log(`[API] Proxy para ${targetUrl}`);
      
      // Fazer requisição para a API real usando axios
      const response = await axios.get(targetUrl, {
        headers: {
          // Remover headers de autenticação para não expor tokens
          'User-Agent': req.headers['user-agent'],
          'Accept': req.headers['accept']
        },
        // Passar eventuais query params
        params: req.query
      });
      
      // Retornar os dados para o cliente
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[API] Erro ao acessar API de roletas:', error.message);
      
      // Se o erro tiver um código de status, usá-lo, senão usar 500
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data || { error: 'Erro ao acessar API de roletas' };
      
      return res.status(statusCode).json(errorMessage);
    }
  }
);

// Alias para endpoint ROULETTES (compatibilidade com código existente)
router.get('/ROULETTES', 
  protect,
  verifyAsaasSubscription({ 
    required: true, 
    allowedPlans: ['BASIC', 'PREMIUM', 'PRO'] 
  }),
  async (req, res) => {
    try {
      // URL alvo protegida
      const targetUrl = 'https://backendapi-production-36b5.up.railway.app/api/roulettes';
      
      console.log(`[API] Proxy para ${targetUrl} (alias ROULETTES)`);
      
      // Fazer requisição para a API real usando axios
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': req.headers['user-agent'],
          'Accept': req.headers['accept']
        },
        params: req.query
      });
      
      // Retornar os dados para o cliente
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[API] Erro ao acessar API de roletas (alias):', error.message);
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data || { error: 'Erro ao acessar API de roletas' };
      
      return res.status(statusCode).json(errorMessage);
    }
  }
);

// Rota de detalhes de roleta específica - também requer assinatura
router.get('/roulettes/:id', 
  protect,
  verifyAsaasSubscription({ 
    required: true, 
    allowedPlans: ['BASIC', 'PREMIUM', 'PRO'] 
  }),
  async (req, res) => {
    try {
      const rouletteId = req.params.id;
      const targetUrl = `https://backendapi-production-36b5.up.railway.app/api/roulettes/${rouletteId}`;
      
      console.log(`[API] Proxy para ${targetUrl}`);
      
      // Fazer requisição para a API real
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': req.headers['user-agent'],
          'Accept': req.headers['accept']
        },
        params: req.query
      });
      
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[API] Erro ao acessar detalhes da roleta:', error.message);
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data || { error: 'Erro ao acessar detalhes da roleta' };
      
      return res.status(statusCode).json(errorMessage);
    }
  }
);

// Rota de números de roleta específica - também requer assinatura
router.get('/roulettes/:id/numbers', 
  protect,
  verifyAsaasSubscription({ 
    required: true, 
    allowedPlans: ['BASIC', 'PREMIUM', 'PRO'] 
  }),
  async (req, res) => {
    try {
      const rouletteId = req.params.id;
      const targetUrl = `https://backendapi-production-36b5.up.railway.app/api/roulettes/${rouletteId}/numbers`;
      
      console.log(`[API] Proxy para ${targetUrl}`);
      
      // Fazer requisição para a API real
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': req.headers['user-agent'],
          'Accept': req.headers['accept']
        },
        params: req.query
      });
      
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[API] Erro ao acessar números da roleta:', error.message);
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data || { error: 'Erro ao acessar números da roleta' };
      
      return res.status(statusCode).json(errorMessage);
    }
  }
);

// Outras rotas protegidas...
// router.use('/user', protect, userRoutes);

module.exports = router; 