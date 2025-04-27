/**
 * Rotas para acesso às roletas
 * Implementa rotas públicas para dados simulados e protegidas para dados reais
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { autenticar } = require('../../backend/middleware/auth');
const { verificarAssinaturaPremium } = require('../../backend/middleware/assinaturaAsaas');

// Importar controlador
const roletaController = require('../controllers/roletaController');

/**
 * Middleware para log de debug
 */
const logRequest = (req, res, next) => {
  console.log(`[API] Requisição recebida: ${req.method} ${req.originalUrl}`);
  console.log(`[API] Parâmetros: ${JSON.stringify(req.params)}`);
  console.log(`[API] Query: ${JSON.stringify(req.query)}`);
  next();
};

// Aplicar middleware de log a todas as rotas
router.use(logRequest);

/**
 * @route   GET /api/roletas
 * @desc    Obter lista de roletas simuladas (acesso livre)
 * @access  Público
 */
router.get('/', roletaController.obterRoletasSimuladas);

/**
 * Rota especial para compatibilidade com o frontend existente
 * Mantém a API existente, mas aplica verificação de assinatura
 */
router.get('/limit/:limit', async (req, res, next) => {
  console.log(`[API] Rota de compatibilidade de limite acessada: ${req.params.limit}`);
  
  try {
    // Verificar se o usuário está autenticado
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      // Se há token, tentar verificar assinatura
      req.asaasCheck = true;
      return autenticar(req, res, () => {
        verificarAssinaturaPremium(req, res, () => {
          // Se autenticado e com assinatura, retornar dados reais
          return roletaController.obterRoletasReais(req, res);
        });
      });
    } else {
      // Se não há token, retornar dados simulados
      console.log('[API] Sem token de autenticação, retornando dados simulados');
      return roletaController.obterRoletasSimuladas(req, res);
    }
  } catch (error) {
    console.error('[API] Erro na rota de compatibilidade:', error);
    return roletaController.obterRoletasSimuladas(req, res);
  }
});

/**
 * @route   GET /api/roletas/:id
 * @desc    Obter dados de uma roleta simulada por ID (acesso livre)
 * @access  Público
 */
router.get('/:id', (req, res, next) => {
  // Rota especial para verificar se não é o endpoint premium/todas
  if (req.params.id === 'premium' && req.path.includes('/premium/todas')) {
    return next();
  }
  
  // Caso contrário, chamar o controlador para dados simulados
  return roletaController.obterRoletaSimuladaPorId(req, res);
});

/**
 * @route   GET /api/roletas/premium/todas
 * @desc    Obter todas as roletas com dados reais (requer assinatura premium)
 * @access  Privado - requer autenticação e assinatura premium
 */
router.get('/premium/todas', 
  autenticar,
  verificarAssinaturaPremium,
  roletaController.obterRoletasReais
);

/**
 * @route   GET /api/roletas/premium/:id/historico
 * @desc    Obter histórico completo de uma roleta (requer assinatura premium)
 * @access  Privado - requer autenticação e assinatura premium
 */
router.get('/premium/:id/historico', 
  autenticar,
  verificarAssinaturaPremium,
  roletaController.obterHistoricoRoletaReal
);

module.exports = router; 