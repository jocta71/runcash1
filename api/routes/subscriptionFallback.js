/**
 * Rotas de fallback para o serviço de assinaturas
 * Estas rotas são usadas apenas quando o serviço principal está indisponível
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');

/**
 * @route   GET /api/subscription-fallback/status
 * @desc    Retorna status básico de assinatura quando o serviço principal está indisponível
 * @access  Private
 */
router.get('/status', authMiddleware.authenticate, async (req, res) => {
  try {
    console.log('[SubscriptionFallback] Fornecendo status básico para', req.user.email);
    
    // Resposta básica de fallback que permite acesso limitado
    const response = {
      success: true,
      message: 'Serviço de assinaturas em manutenção. Fornecendo acesso básico temporário.',
      fallback: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name
      },
      subscription: {
        status: 'FALLBACK_MODE',
        value: 0,
        nextDueDate: null,
      },
      apiAccess: {
        isActive: true,
        plan: 'BASIC',
        dailyLimit: 50,
        requestCount: 0
      }
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('[SubscriptionFallback] Erro:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status da assinatura',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 