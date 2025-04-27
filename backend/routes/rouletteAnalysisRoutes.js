/**
 * Rotas para análise de roletas
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
  console.log('[API] Usando middleware de autenticação simplificado em rotas de análise');
} catch (err) {
  // Fallback para o middleware original se o simplificado não existir
  try {
    authMiddleware = require('../middlewares/authMiddleware');
    console.log('[API] Usando middleware de autenticação padrão em rotas de análise');
  } catch (error) {
    console.error('[API] Erro ao carregar middleware de autenticação:', error.message);
    // Criar um middleware vazio que apenas passa para o próximo
    authMiddleware = {
      proteger: (req, res, next) => next(),
      authenticate: () => (req, res, next) => next()
    };
    console.warn('[API] Usando middleware de autenticação "dummy" em rotas de análise (nenhuma verificação)');
  }
}

try {
  // Tentar carregar o middleware de assinatura
  subscriptionMiddleware = require('../middlewares/asaasSubscriptionMiddleware');
  console.log('[API] Middleware de verificação de assinatura carregado em rotas de análise');
} catch (error) {
  console.error('[API] Erro ao carregar middleware de assinatura:', error.message);
  // Criar um middleware vazio que apenas passa para o próximo
  subscriptionMiddleware = {
    verificarAssinatura: () => (req, res, next) => next(),
    verificarAssinaturaBasica: (req, res, next) => next()
  };
  console.warn('[API] Usando middleware de assinatura "dummy" em rotas de análise (nenhuma verificação)');
}

// Extrair os middlewares necessários
const { proteger } = authMiddleware;
const { verificarAssinatura, verificarAssinaturaBasica } = subscriptionMiddleware;

// Importar controller
const analysisController = require('../controllers/rouletteAnalysisController');

// Verificação se o controller existe e criar um dummy se necessário
if (!analysisController) {
  console.error('[API] Controller de análise não encontrado, criando mock');
  
  // Criar um controller fictício que retorna dados vazios
  analysisController = {
    getPatternAnalysis: (req, res) => res.json({}),
    getNumberTrends: (req, res) => res.json([]),
    getAdvancedStats: (req, res) => res.json({}),
    getSessionRecommendations: (req, res) => res.json([]),
    getPredictions: (req, res) => res.json({})
  };
}

/**
 * @route   GET /api/analysis/:rouletteId/patterns
 * @desc    Obtém análise de padrões para uma roleta específica
 * @access  Privado - Requer assinatura
 */
router.get('/analysis/:rouletteId/patterns', 
  proteger,
  verificarAssinaturaBasica,
  analysisController.getPatternAnalysis
);

/**
 * @route   GET /api/analysis/:rouletteId/trends
 * @desc    Obtém tendências de números para uma roleta específica
 * @access  Privado - Requer assinatura
 */
router.get('/analysis/:rouletteId/trends', 
  proteger,
  verificarAssinaturaBasica,
  analysisController.getNumberTrends
);

/**
 * @route   GET /api/analysis/:rouletteId/advanced
 * @desc    Obtém estatísticas avançadas (assinantes premium)
 * @access  Privado - Requer assinatura premium
 */
router.get('/analysis/:rouletteId/advanced', 
  proteger,
  verificarAssinatura(),
  analysisController.getAdvancedStats
);

/**
 * @route   GET /api/analysis/:rouletteId/recommendations
 * @desc    Obtém recomendações para sessão atual (assinantes premium)
 * @access  Privado - Requer assinatura premium
 */
router.get('/analysis/:rouletteId/recommendations', 
  proteger,
  verificarAssinatura(),
  analysisController.getSessionRecommendations
);

/**
 * @route   GET /api/analysis/:rouletteId/predict
 * @desc    Obtém possíveis predições (assinantes premium)
 * @access  Privado - Requer assinatura premium
 */
router.get('/analysis/:rouletteId/predict', 
  proteger,
  verificarAssinatura(),
  analysisController.getPredictions
);

module.exports = router; 