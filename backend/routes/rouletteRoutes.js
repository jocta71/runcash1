/**
 * Rotas para dados de roletas
 * Implementa diferentes níveis de acesso baseados em assinatura
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Importar middlewares
const { verifyTokenAndSubscription, requireResourceAccess } = require('../middlewares/asaasAuthMiddleware');
const { checkSubscription } = require('../middleware/subscriptionCheck');

// Importar controller
const rouletteController = require('../controllers/rouletteController');

/**
 * @route   GET /api/roulettes
 * @desc    Lista todas as roletas disponíveis (requer assinatura ativa)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes', 
  checkSubscription,
  async (req, res) => {
    try {
      // Gerar ID de requisição único para rastreamento
      const requestId = crypto.randomUUID();
      
      // Log detalhado do acesso
      console.log(`[API] Acesso autorizado à rota /api/roulettes`);
      console.log(`[API] Request ID: ${requestId}`);
      console.log(`[API] Usuário ID: ${req.user.id}`);
      console.log(`[API] Timestamp: ${new Date().toISOString()}`);
      
      // Adicionar informações de plano para manter compatibilidade
      req.userPlan = { type: 'PRO' }; // Definimos como PRO pois passou pela verificação
      
      // Redirecionar para o controller que lista as roletas
      return rouletteController.listRoulettes(req, res);
    } catch (error) {
      console.error(`[API] Erro ao processar requisição para /api/roulettes:`, error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao processar a requisição',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @route   GET /api/roulettes/:id/basic
 * @desc    Obtém dados básicos de uma roleta específica
 * @access  Público
 */
router.get('/roulettes/:id/basic', 
  rouletteController.getBasicRouletteData
);

/**
 * @route   GET /api/roulettes/:id/recent
 * @desc    Obtém números recentes de uma roleta (limitado por plano)
 * @access  Público com limitações
 */
router.get('/roulettes/:id/recent', 
  // Deixamos sem verificação para acesso público limitado
  (req, res, next) => {
    // Adicionar userPlan como FREE para compatibilidade
    req.userPlan = { type: 'FREE' };
    next();
  },
  rouletteController.getRecentNumbers
);

/**
 * @route   GET /api/roulettes/:id/detailed
 * @desc    Obtém dados detalhados da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/detailed', 
  checkSubscription,
  (req, res, next) => {
    // Adicionar userPlan como PRO para compatibilidade
    req.userPlan = { type: 'PRO' };
    
    // Manter compatibilidade com requireResourceAccess
    req.subscription = { 
      id: 'local-subscription',
      status: 'active'
    };
    
    next();
  },
  requireResourceAccess('standard_stats'),
  rouletteController.getDetailedRouletteData
);

/**
 * @route   GET /api/roulettes/:id/stats
 * @desc    Obtém estatísticas detalhadas da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/stats', 
  checkSubscription,
  (req, res, next) => {
    // Adicionar userPlan como PRO para compatibilidade
    req.userPlan = { type: 'PRO' };
    
    // Manter compatibilidade com requireResourceAccess
    req.subscription = { 
      id: 'local-subscription',
      status: 'active'
    };
    
    next();
  },
  requireResourceAccess('standard_stats'),
  rouletteController.getRouletteStatistics
);

/**
 * @route   GET /api/roulettes/:id/historical
 * @desc    Obtém dados históricos avançados (para assinantes premium)
 * @access  Privado - Requer assinatura premium
 */
router.get('/roulettes/7d3c2c9f-2850-f642-861f-5bb4daf1806a/historical', 
  verifyTokenAndSubscription({ 
    required: true,
    allowedPlans: ['PREMIUM']
  }),
  requireResourceAccess('historical_data'),
  rouletteController.getHistoricalData
);

/**
 * @route   GET /api/roulettes/:id/batch
 * @desc    Obtém lote de números (últimos 1000) - requer assinatura
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/batch', 
  checkSubscription,
  (req, res, next) => {
    // Adicionar userPlan como PRO para compatibilidade
    req.userPlan = { type: 'PRO' };
    
    // Manter compatibilidade com requireResourceAccess
    req.subscription = { 
      id: 'local-subscription',
      status: 'active'
    };
    
    next();
  },
  requireResourceAccess('standard_stats'),
  rouletteController.getNumbersBatch
);

/**
 * @route   GET /api/roulettes/:id/preview
 * @desc    Versão degradada para usuários sem assinatura
 * @access  Público
 */
router.get('/roulettes/:id/preview', 
  rouletteController.getFreePreview
);

module.exports = router; 