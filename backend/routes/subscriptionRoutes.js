/**
 * Rotas para gerenciamento de assinaturas
 * Implementa endpoints para verificação e gestão de assinaturas
 */

const express = require('express');
const router = express.Router();
const { verifyTokenAndSubscription } = require('../middlewares/asaasAuthMiddleware');
const asaasService = require('../services/asaasService');

// Importar middlewares
const { authenticate } = require('../middlewares/authMiddleware');
const { verificarPlano } = require('../middlewares/unifiedSubscriptionMiddleware');
const subscriptionVerifier = require('../middlewares/subscriptionVerifier');

/**
 * @route   GET /api/subscription/status
 * @desc    Verifica o status da assinatura do usuário (Asaas)
 * @access  Privado - Requer autenticação
 */
router.get('/status/asaas', 
  verifyTokenAndSubscription({ required: true, allowedPlans: [] }), 
  async (req, res) => {
    try {
      // O usuário já foi autenticado pelo middleware verifyTokenAndSubscription
      // Agora podemos verificar o status da assinatura diretamente no Asaas
      const customerId = req.usuario.asaasCustomerId;
      
      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'Usuário não possui ID de cliente no Asaas',
          hasActiveSubscription: false
        });
      }
      
      // Verificar status da assinatura no Asaas
      const subscriptionStatus = await asaasService.checkSubscriptionStatus(customerId);
      
      return res.status(200).json({
        success: true,
        ...subscriptionStatus
      });
    } catch (error) {
      console.error('Erro ao verificar status da assinatura:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar status da assinatura',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/subscription/details
 * @desc    Obtém detalhes da assinatura do usuário
 * @access  Privado - Requer autenticação
 */
router.get('/details', 
  verifyTokenAndSubscription({ required: true, allowedPlans: [] }), 
  async (req, res) => {
    try {
      // O usuário já foi autenticado pelo middleware
      const customerId = req.usuario.asaasCustomerId;
      
      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'Usuário não possui ID de cliente no Asaas'
        });
      }
      
      // Verificar status da assinatura no Asaas
      const subscriptionStatus = await asaasService.checkSubscriptionStatus(customerId);
      
      // Se não houver assinatura ativa, retornar erro
      if (!subscriptionStatus.hasActiveSubscription) {
        return res.status(403).json({
          success: false,
          message: 'Usuário não possui assinatura ativa',
          subscriptionStatus
        });
      }
      
      return res.status(200).json({
        success: true,
        subscription: subscriptionStatus.subscription,
        pendingPayments: subscriptionStatus.pendingPayments || []
      });
    } catch (error) {
      console.error('Erro ao obter detalhes da assinatura:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao obter detalhes da assinatura',
        error: error.message
      });
    }
  }
);

// Rotas para verificação de assinatura
/**
 * @route   GET /api/subscription/status
 * @desc    Verifica e retorna o status da assinatura do usuário (Versão unificada)
 * @access  Público / Autenticação Opcional
 */
router.get('/status', 
  authenticate({ required: false }),
  subscriptionVerifier.getSubscriptionStatus
);

// Outras rotas existentes...
// ... existing code ...

module.exports = router; 