/**
 * Rotas para dados de roletas
 * Implementa diferentes níveis de acesso baseados em assinatura
 */

const express = require('express');
const router = express.Router();

// Importar middlewares simplificados
let authMiddleware;
let subscriptionMiddleware;

try {
  // Tentar carregar o middleware simplificado primeiro
  authMiddleware = require('../middlewares/simpleAuthMiddleware');
  console.log('[API] Usando middleware de autenticação simplificado em rotas de roleta');
} catch (err) {
  // Fallback para o middleware original se o simplificado não existir
  try {
    authMiddleware = require('../middlewares/authMiddleware');
    console.log('[API] Usando middleware de autenticação padrão em rotas de roleta');
  } catch (error) {
    console.error('[API] Erro ao carregar middleware de autenticação:', error.message);
    // Criar um middleware vazio que apenas passa para o próximo
    authMiddleware = {
      proteger: (req, res, next) => next(),
      authenticate: () => (req, res, next) => next()
    };
    console.warn('[API] Usando middleware de autenticação "dummy" em rotas de roleta (nenhuma verificação)');
  }
}

try {
  // Tentar carregar o middleware de assinatura
  subscriptionMiddleware = require('../middlewares/asaasSubscriptionMiddleware');
  console.log('[API] Middleware de verificação de assinatura carregado em rotas de roleta');
} catch (error) {
  console.error('[API] Erro ao carregar middleware de assinatura:', error.message);
  // Criar um middleware vazio que apenas passa para o próximo
  subscriptionMiddleware = {
    verificarAssinatura: () => (req, res, next) => next(),
    verificarAssinaturaBasica: (req, res, next) => next()
  };
  console.warn('[API] Usando middleware de assinatura "dummy" em rotas de roleta (nenhuma verificação)');
}

// Extrair os middlewares necessários
const { proteger } = authMiddleware;
const { verificarAssinatura, verificarAssinaturaBasica } = subscriptionMiddleware;

// Importar controller
const rouletteController = require('../controllers/rouletteController');

// Verificação se o controller existe e criar um dummy se necessário
if (!rouletteController) {
  console.error('[API] Controller de roletas não encontrado, criando mock');
  
  // Criar um controller fictício que retorna dados vazios
  rouletteController = {
    listRoulettes: (req, res) => res.json([]),
    getBasicRouletteData: (req, res) => res.json({}),
    getRecentNumbers: (req, res) => res.json([]),
    getDetailedRouletteData: (req, res) => res.json({}),
    getRouletteStatistics: (req, res) => res.json({}),
    getHistoricalData: (req, res) => res.json({}),
    getNumbersBatch: (req, res) => res.json([]),
    getFreePreview: (req, res) => res.json({})
  };
}

/**
 * @route   GET /api/roulettes
 * @desc    Lista todas as roletas disponíveis (limitado por plano)
 * @access  Público - Temporariamente sem verificação
 */
router.get('/roulettes', 
  rouletteController.listRoulettes
);

/**
 * @route   GET /api/roulettes/:id/basic
 * @desc    Obtém dados básicos de uma roleta específica
 * @access  Público - Temporariamente sem verificação
 */
router.get('/roulettes/:id/basic', 
  rouletteController.getBasicRouletteData
);

/**
 * @route   GET /api/roulettes/:id/recent
 * @desc    Obtém números recentes de uma roleta (limitado por plano)
 * @access  Público - Temporariamente sem verificação
 */
router.get('/roulettes/:id/recent', 
  rouletteController.getRecentNumbers
);

/**
 * @route   GET /api/roulettes/:id/detailed
 * @desc    Obtém dados detalhados da roleta (para assinantes)
 * @access  Público - Temporariamente sem verificação
 */
router.get('/roulettes/:id/detailed', 
  rouletteController.getDetailedRouletteData
);

/**
 * @route   GET /api/roulettes/:id/stats
 * @desc    Obtém estatísticas detalhadas da roleta (para assinantes)
 * @access  Público - Temporariamente sem verificação
 */
router.get('/roulettes/:id/stats', 
  rouletteController.getRouletteStatistics
);

/**
 * @route   GET /api/roulettes/:id/historical
 * @desc    Obtém dados históricos avançados (para assinantes premium)
 * @access  Público - Temporariamente sem verificação
 */
router.get('/roulettes/7d3c2c9f-2850-f642-861f-5bb4daf1806a/historical', 
  rouletteController.getHistoricalData
);

/**
 * @route   GET /api/roulettes/:id/batch
 * @desc    Obtém lote de números (últimos 1000) - requer assinatura
 * @access  Público - Temporariamente sem verificação
 */
router.get('/roulettes/:id/batch', 
  rouletteController.getNumbersBatch
);

/**
 * @route   GET /api/roulettes/:id/preview
 * @desc    Versão gratuita para não-assinantes (limitada)
 * @access  Público
 */
router.get('/roulettes/:id/preview', 
  rouletteController.getFreePreview
);

// Adicionar rota uppercase para compatibilidade com frontend
router.get('/ROULETTES', rouletteController.listRoulettes);

module.exports = router; 