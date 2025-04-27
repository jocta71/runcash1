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
 * @route   GET /api/roletas
 * @desc    Obter lista de roletas simuladas (acesso livre)
 * @access  Público
 */
router.get('/', roletaController.obterRoletasSimuladas);

/**
 * @route   GET /api/roletas/:id
 * @desc    Obter dados de uma roleta simulada por ID (acesso livre)
 * @access  Público
 */
router.get('/:id', roletaController.obterRoletaSimuladaPorId);

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