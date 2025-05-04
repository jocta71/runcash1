/**
 * Rotas para streaming de eventos em tempo real
 * Implementa Server-Sent Events (SSE) para enviar atualizações ao cliente
 */

const express = require('express');
const router = express.Router();
const streamController = require('../controllers/streamController');
const { authenticateToken } = require('../middlewares/jwtAuthMiddleware');
const { requireSubscription } = require('../middlewares/subscriptionMiddleware');
const { checkSubscription } = require('../middleware/subscriptionCheck');

// Rota de verificação de status (pública)
router.get('/status', streamController.checkStreamStatus);

/**
 * @route   GET /stream/rounds/:gameType/:gameId/:version/live
 * @desc    Estabelece conexão SSE para atualizações em tempo real
 * @access  Privado - Requer assinatura ativa
 * @params  gameType - Tipo de jogo (ex: ROULETTE)
 *          gameId - ID do jogo específico
 *          version - Versão da API (opcional, padrão v1)
 * @query   k - Parâmetro de controle (opcional)
 */
router.get('/rounds/:gameType/:gameId/:version/live', 
  // Verificar autenticação do usuário
  authenticateToken({ required: true }),
  
  // Verificar se o usuário tem assinatura ativa
  async (req, res, next) => {
    try {
      // Aplicar middleware de verificação de assinatura
      checkSubscription(req, res, next);
    } catch (error) {
      console.error('[STREAM] Erro ao verificar assinatura:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar assinatura para acesso ao stream',
        error: error.message
      });
    }
  },
  
  // Se passou pela verificação de assinatura, estabelecer o stream
  streamController.establishRouletteStream
);

/**
 * @route   GET /stream/rounds/:gameType/:gameId/live
 * @desc    Versão simplificada da rota de streaming (sem versão específica)
 * @access  Privado - Requer assinatura ativa
 */
router.get('/rounds/:gameType/:gameId/live', 
  authenticateToken({ required: true }),
  checkSubscription,
  streamController.establishRouletteStream
);

// Rotas de compatibilidade para diferentes padrões de URL
// Para manter compatibilidade com urls esperadas pelos clients

/**
 * @route   GET /stream/:gameType/:gameId
 * @desc    Formato alternativo para estabelecer conexão SSE
 * @access  Privado - Requer assinatura ativa
 */
router.get('/:gameType/:gameId', 
  authenticateToken({ required: true }),
  checkSubscription,
  (req, res) => {
    // Redirecionar para a rota padrão
    req.params.version = 'v1';
    streamController.establishRouletteStream(req, res);
  }
);

module.exports = router; 