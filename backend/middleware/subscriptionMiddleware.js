/**
 * Middleware para verificar se o usuário possui assinatura ativa
 * Verifica no MongoDB se o usuário tem um plano ativo no Asaas
 */

const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

/**
 * Middleware para verificar assinatura
 * Adiciona req.subscription com detalhes da assinatura se existir
 */
const checkSubscription = async (req, res, next) => {
  // Pular verificação se a rota não requer assinatura
  if (req.skipSubscriptionCheck) {
    return next();
  }

  try {
    // Verificar se usuário está autenticado
    if (!req.user || !req.user._id) {
      req.hasActiveSubscription = false;
      return next();
    }

    const userId = req.user._id;
    const db = await getDb();
    
    // Buscar assinatura ativa do usuário
    const subscription = await db.collection('subscriptions').findOne({
      userId: ObjectId.isValid(userId) ? new ObjectId(userId) : userId,
      status: 'ACTIVE',
      expiryDate: { $gt: new Date() } // Data de expiração maior que agora
    });

    if (subscription) {
      // Usuário tem assinatura ativa
      req.hasActiveSubscription = true;
      req.subscription = subscription;
      req.userPlan = {
        type: subscription.planType,
        expiryDate: subscription.expiryDate
      };
    } else {
      // Usuário não tem assinatura ativa
      req.hasActiveSubscription = false;
    }

    next();
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    // Em caso de erro, permitir acesso mas registrar que não há assinatura confirmada
    req.hasActiveSubscription = false;
    next();
  }
};

/**
 * Middleware que requer assinatura ativa para continuar
 * Deve ser usado após o middleware checkSubscription
 */
const requireSubscription = (req, res, next) => {
  if (req.hasActiveSubscription) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Esta funcionalidade requer uma assinatura ativa',
    code: 'SUBSCRIPTION_REQUIRED'
  });
};

module.exports = {
  checkSubscription,
  requireSubscription
}; 