/**
 * API para gerenciamento de assinaturas
 */
const express = require('express');
const router = express.Router();
const getDb = require('../services/database');
const { ObjectId } = require('mongodb');
const { optionalAuth, checkSubscription } = require('./middleware/auth');

/**
 * @route GET /api/subscription/status
 * @desc Verifica o status da assinatura do usuário
 * @access Público (com autenticação opcional)
 */
router.get('/status', optionalAuth, checkSubscription, async (req, res) => {
  try {
    // Se o usuário não estiver autenticado, retornar status de não assinante
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

    // Se já verificamos a assinatura no middleware, usamos essa informação
    if (req.hasActiveSubscription === false) {
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

    // Se temos informações de assinatura
    if (req.subscription) {
      // Buscar detalhes do plano
      const db = await getDb();
      const userPlan = await db.collection('plans').findOne({
        id: req.subscription.plan_id
      });

      return res.status(200).json({
        success: true,
        message: 'Assinatura ativa encontrada',
        subscription: {
          status: 'active',
          plan: req.subscription.plan_id,
          planName: userPlan?.name || 'Plano Padrão',
          startDate: req.subscription.activationDate || req.subscription.created_at,
          expirationDate: req.subscription.expirationDate,
          features: userPlan?.allowedFeatures || []
        },
        hasActiveSubscription: true
      });
    }

    // Se temos informações da assinatura no formato antigo
    if (req.assinatura) {
      // Buscar detalhes do plano
      const db = await getDb();
      const planInfo = await db.collection('planos').findOne({
        _id: ObjectId.isValid(req.assinatura.plano) ? new ObjectId(req.assinatura.plano) : null,
        identificador: req.assinatura.plano
      });

      return res.status(200).json({
        success: true,
        message: 'Assinatura ativa encontrada',
        subscription: {
          status: 'active',
          plan: req.assinatura.plano,
          planName: planInfo?.nome || 'Plano Padrão',
          startDate: req.assinatura.dataInicio,
          expirationDate: req.assinatura.validade,
          features: planInfo?.recursos || []
        },
        hasActiveSubscription: true
      });
    }

    // Caso de fallback - situação inesperada
    return res.status(200).json({
      success: true,
      message: 'Status de assinatura indeterminado',
      subscription: {
        status: 'unknown',
        plan: null,
        features: []
      },
      hasActiveSubscription: false
    });
  } catch (error) {
    console.error('Erro ao verificar status da assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status da assinatura',
      error: error.message
    });
  }
});

/**
 * @route GET /api/subscription/verify/:customerId
 * @desc Verifica assinatura pelo ID do cliente
 * @access Público
 */
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
    
    // Verificar no formato mais recente
    const subscription = await db.collection('subscriptions').findOne({
      customer_id: customerId,
      status: { $in: ['active', 'ACTIVE', 'ativa'] },
      expirationDate: { $gt: new Date() }
    });
    
    if (subscription) {
      return res.status(200).json({
        success: true,
        hasActiveSubscription: true,
        subscription: {
          id: subscription._id.toString(),
          plan: subscription.plan_id,
          status: subscription.status,
          expirationDate: subscription.expirationDate
        }
      });
    }
    
    // Tentar no formato antigo
    const assinatura = await db.collection('assinaturas').findOne({
      asaasCustomerId: customerId,
      status: 'ativa',
      validade: { $gt: new Date() }
    });
    
    if (assinatura) {
      return res.status(200).json({
        success: true,
        hasActiveSubscription: true,
        subscription: {
          id: assinatura._id.toString(),
          plan: assinatura.plano,
          status: assinatura.status,
          expirationDate: assinatura.validade
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      hasActiveSubscription: false,
      subscription: null
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

module.exports = router; 