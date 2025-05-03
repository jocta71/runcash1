/**
 * Rotas para dados de roletas
 * Implementa diferentes níveis de acesso baseados em assinatura
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Importar middlewares
const { verifyTokenAndSubscription, requireResourceAccess } = require('../middlewares/asaasAuthMiddleware');

// Importar controller
const rouletteController = require('../controllers/rouletteController');

/**
 * @route   GET /api/roulettes
 * @desc    ROTA DESATIVADA - Retorna 403 Forbidden
 * @access  Bloqueado
 */
router.get('/roulettes', (req, res) => {
  // Gerar ID de requisição único para rastreamento
  const requestId = crypto.randomUUID();
  
  // Log detalhado do bloqueio com informações importantes para auditoria
  console.log(`[FIREWALL] Bloqueando acesso à rota desativada: /api/roulettes`);
  console.log(`[FIREWALL] Request ID: ${requestId}`);
  console.log(`[FIREWALL] Headers: ${JSON.stringify(req.headers)}`);
  console.log(`[FIREWALL] IP: ${req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'}`);
  console.log(`[FIREWALL] User-Agent: ${req.headers['user-agent'] || 'unknown'}`);
  console.log(`[FIREWALL] Timestamp: ${new Date().toISOString()}`);
  
  // Configurar cabeçalhos CORS para a resposta
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Responder com 403 Forbidden
  return res.status(403).json({
    success: false,
    message: 'Esta rota foi desativada por razões de segurança.',
    code: 'ROUTE_DISABLED',
    requestId: requestId,
    alternativeEndpoints: ['/api/roletas', '/api/ROULETTES'],
    timestamp: new Date().toISOString()
  });
});

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
  verifyTokenAndSubscription({ required: false }), // Autenticação opcional
  rouletteController.getRecentNumbers
);

/**
 * @route   GET /api/roulettes/:id/detailed
 * @desc    Obtém dados detalhados da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/detailed', 
  verifyTokenAndSubscription({ 
    required: true,
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM']
  }),
  requireResourceAccess('standard_stats'),
  rouletteController.getDetailedRouletteData
);

/**
 * @route   GET /api/roulettes/:id/stats
 * @desc    Obtém estatísticas detalhadas da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/stats', 
  verifyTokenAndSubscription({
    required: true,
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM']
  }),
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
  verifyTokenAndSubscription({
    required: true,
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM']
  }),
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