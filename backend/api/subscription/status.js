/**
 * API para verificar o status da assinatura do usuário
 * Fornece informações sobre o plano atual e acesso a recursos premium
 */

const { ObjectId } = require('mongodb');
const getDb = require('../../services/database');

/**
 * Endpoint para verificar status da assinatura
 * @route GET /api/subscription/status
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 */
const getSubscriptionStatus = async (req, res) => {
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
    
    // Primeiro tenta na coleção Subscription
    let userSubscription = await db.collection('Subscription').findOne({
      userId: new ObjectId(userId),
      status: { $in: ['ACTIVE', 'RECEIVED', 'CONFIRMED'] }
    });

    // Se não encontrar, verifica na coleção 'subscriptions' para compatibilidade
    if (!userSubscription) {
      userSubscription = await db.collection('subscriptions').findOne({
        user_id: userId,
        status: { $in: ['active', 'ACTIVE', 'ativa', 'RECEIVED', 'CONFIRMED'] }
      });
    }

    if (!userSubscription) {
      return res.status(200).json({
        success: true,
        message: 'Nenhuma assinatura ativa encontrada',
        subscription: {
          status: 'inactive',
          plan: null,
          features: []
        },
        hasActiveSubscription: false,
        canAccessRoulettes: false,
        redirectTo: '/planos'
      });
    }

    // Determinar o tipo de plano
    const planType = 
      userSubscription.planType || 
      userSubscription.plan_id || 
      userSubscription.plan || 
      'BASIC';

    // Determinar recursos disponíveis baseado no plano
    const features = [];
    let canAccessRoulettes = false;

    switch (planType.toUpperCase()) {
      case 'PREMIUM':
      case 'PRO':
        features.push('access_all_roulettes', 'priority_support', 'advanced_analytics');
        canAccessRoulettes = true;
        break;
      case 'BASIC':
        features.push('access_roulettes');
        canAccessRoulettes = true;
        break;
      default:
        features.push('basic_access');
        canAccessRoulettes = false;
    }

    // Retornar status da assinatura e recursos disponíveis
    return res.status(200).json({
      success: true,
      message: 'Assinatura ativa encontrada',
      subscription: {
        status: userSubscription.status,
        plan: planType,
        nextDueDate: userSubscription.nextDueDate || userSubscription.expirationDate,
        features
      },
      hasActiveSubscription: true,
      canAccessRoulettes
    });
  } catch (error) {
    console.error('Erro ao verificar status da assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status da assinatura',
      error: error.message
    });
  }
};

module.exports = {
  getSubscriptionStatus
}; 