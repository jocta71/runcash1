/**
 * Rotas para dados de roletas
 * Implementa diferentes níveis de acesso baseados em assinatura
 */

const express = require('express');
const router = express.Router();
const verificarAssinaturaRoletas = require('../../middleware/verificarAssinaturaRoletas');
const DadosSimuladosService = require('../../services/DadosSimuladosService');

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
 * Middleware para verificar acesso a dados específicos de roletas
 * Redireciona para dados simulados ou reais com base na assinatura
 */
const verificarAcessoRoleta = (req, res, next) => {
  // Se não tiver nível de acesso definido, aplicar o middleware
  if (!req.nivelAcessoRoletas) {
    return verificarAssinaturaRoletas(req, res, () => {
      handleRouletteAccess(req, res, next);
    });
  }
  
  // Se já tiver nível de acesso definido, verificar diretamente
  handleRouletteAccess(req, res, next);
};

/**
 * Função auxiliar para tratar o acesso baseado no nível
 */
const handleRouletteAccess = (req, res, next) => {
  // Se for acesso simulado, retornar dados simulados
  if (req.nivelAcessoRoletas === 'simulado') {
    // Obter ID da roleta da URL
    const roletaId = req.params.id;
    
    // Obter limite da query string
    const limit = parseInt(req.query.limit) || 20;
    
    // Buscar dados simulados
    const dadosSimulados = DadosSimuladosService.obterRoletaSimuladaPorId(roletaId, limit);
    
    // Se não encontrou dados simulados para este ID, tente usar um ID padrão
    if (!dadosSimulados) {
      return res.json(DadosSimuladosService.obterRoletaSimuladaPorId('sim_001', limit));
    }
    
    return res.json(dadosSimulados);
  }
  
  // Caso contrário, continuar para o próximo middleware (dados reais)
  next();
};

// Aplicar verificação de assinatura a todas as rotas
router.use(verificarAssinaturaRoletas);

/**
 * @route   GET /api/roulettes
 * @desc    Lista todas as roletas disponíveis (limitado por plano)
 * @access  Privado - Requer autenticação básica
 */
router.get('/roulettes', 
  proteger,
  rouletteController.listRoulettes
);

/**
 * @route   GET /api/roulettes/:id/basic
 * @desc    Obtém dados básicos de uma roleta específica
 * @access  Privado - Requer autenticação básica
 */
router.get('/roulettes/:id/basic', 
  proteger,
  verificarAcessoRoleta,
  rouletteController.getBasicRouletteData
);

/**
 * @route   GET /api/roulettes/:id/recent
 * @desc    Obtém números recentes de uma roleta (limitado por plano)
 * @access  Privado - Requer autenticação básica
 */
router.get('/roulettes/:id/recent', 
  proteger,
  verificarAcessoRoleta,
  rouletteController.getRecentNumbers
);

/**
 * @route   GET /api/roulettes/:id/detailed
 * @desc    Obtém dados detalhados da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/detailed', 
  proteger,
  verificarAcessoRoleta,
  rouletteController.getDetailedRouletteData
);

/**
 * @route   GET /api/roulettes/:id/stats
 * @desc    Obtém estatísticas detalhadas da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/stats', 
  proteger,
  verificarAcessoRoleta,
  rouletteController.getRouletteStatistics
);

/**
 * @route   GET /api/roulettes/:id/historical
 * @desc    Obtém dados históricos avançados (para assinantes premium)
 * @access  Privado - Requer assinatura premium
 */
router.get('/roulettes/7d3c2c9f-2850-f642-861f-5bb4daf1806a/historical', 
  proteger,
  verificarAcessoRoleta,
  rouletteController.getHistoricalData
);

/**
 * @route   GET /api/roulettes/:id/batch
 * @desc    Obtém lote de números (últimos 1000) - requer assinatura
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/batch', 
  proteger,
  verificarAcessoRoleta,
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
router.get('/ROULETTES', proteger, rouletteController.listRoulettes);

module.exports = router; 