/**
 * Rotas para gerenciamento de assinaturas
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { authenticate } = require('../middlewares/authMiddleware');
const { verificarPlano } = require('../middlewares/unifiedSubscriptionMiddleware');
const subscriptionVerifier = require('../middlewares/subscriptionVerifier');
const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

// Rotas para verificação de assinatura
/**
 * @route   GET /api/subscription/status
 * @desc    Verifica e retorna o status da assinatura do usuário
 * @access  Público / Autenticação Opcional
 */
router.get('/status', 
  authenticate({ required: false }),
  async (req, res) => {
    try {
      // Verificar se o usuário está autenticado
      if (!req.user && !req.usuario) {
        return res.status(200).json({
          success: true,
          message: 'Usuário não autenticado',
          subscription: {
            status: 'inactive',
            plan: null,
            features: []
          },
          hasActiveSubscription: false
        });
      }

      const userId = req.user?.id || req.usuario?.id;
      
      // Buscar assinatura ativa no banco de dados
      const db = await getDb();
      const userSubscription = await db.collection('subscriptions').findOne({
        user_id: userId,
        status: { $in: ['active', 'ACTIVE', 'ativa'] },
        expirationDate: { $gt: new Date() }
      });
      
      // Se não encontrar assinatura no formato das collections, tentar o modelo mongoose
      if (!userSubscription) {
        // Verificar em modelos mongoose se não encontrou na collection
        const assinatura = await db.collection('assinaturas').findOne({
          usuario: ObjectId.isValid(userId) ? new ObjectId(userId) : userId,
          status: 'ativa',
          validade: { $gt: new Date() }
        });

        if (!assinatura) {
          return res.status(200).json({
            success: true,
            message: 'Usuário não possui assinatura ativa',
            subscription: {
              status: 'inactive',
              plan: null,
              features: []
            },
            hasActiveSubscription: false
          });
        }

        // Buscar detalhes do plano
        const planInfo = await db.collection('planos').findOne({
          _id: ObjectId.isValid(assinatura.plano) ? new ObjectId(assinatura.plano) : null,
          identificador: assinatura.plano
        });

        return res.status(200).json({
          success: true,
          message: 'Assinatura ativa encontrada',
          subscription: {
            status: 'active',
            plan: assinatura.plano,
            planName: planInfo?.nome || 'Plano Padrão',
            startDate: assinatura.dataInicio,
            expirationDate: assinatura.validade,
            features: planInfo?.recursos || []
          },
          hasActiveSubscription: true
        });
      }
      
      // Verificar se a assinatura está expirada
      if (userSubscription.expirationDate && new Date(userSubscription.expirationDate) < new Date()) {
        return res.status(200).json({
          success: true,
          message: 'Assinatura expirada',
          subscription: {
            status: 'expired',
            plan: userSubscription.plan_id,
            expirationDate: userSubscription.expirationDate,
            features: []
          },
          hasActiveSubscription: false
        });
      }
      
      // Buscar detalhes do plano
      const userPlan = await db.collection('plans').findOne({
        id: userSubscription.plan_id
      });
      
      return res.status(200).json({
        success: true,
        message: 'Assinatura ativa encontrada',
        subscription: {
          status: 'active',
          plan: userSubscription.plan_id,
          planName: userPlan?.name || 'Plano Padrão',
          startDate: userSubscription.activationDate || userSubscription.created_at,
          expirationDate: userSubscription.expirationDate,
          features: userPlan?.allowedFeatures || []
        },
        hasActiveSubscription: true
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

// Rota especial para verificar assinatura sem autenticação (para uso com ID de cliente)
router.get('/verify/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ID do cliente não fornecido'
      });
    }
    
    const db = await getDb();
    const subscription = await db.collection('subscriptions').findOne({
      customer_id: customerId,
      status: { $in: ['active', 'ACTIVE', 'ativa'] },
      expirationDate: { $gt: new Date() }
    });
    
    if (!subscription) {
      return res.status(200).json({
        success: true,
        hasActiveSubscription: false,
        subscription: null
      });
    }
    
    return res.status(200).json({
      success: true,
      hasActiveSubscription: true,
      subscription: {
        id: subscription._id,
        plan: subscription.plan_id,
        status: subscription.status,
        expirationDate: subscription.expirationDate
      }
    });
  } catch (error) {
    console.error('Erro ao verificar assinatura por ID de cliente:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar assinatura por ID de cliente',
      error: error.message
    });
  }
});

// Outras rotas existentes...
// ... existing code ...

module.exports = router; 