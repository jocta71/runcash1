/**
 * Rotas para gerenciamento de assinaturas
 * Inclui verificação de status, gerenciamento de planos e webhooks
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { getSubscriptionStatus } = require('../api/subscription/status');

/**
 * @route   GET /api/subscription/status
 * @desc    Verifica status da assinatura do usuário
 * @access  Público - Não requer autenticação, mas fornece mais infos se autenticado
 */
router.get('/status', protect, getSubscriptionStatus);

module.exports = router; 