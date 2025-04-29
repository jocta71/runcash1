const Subscription = require('../models/Subscription');

/**
 * Middleware para verificar se o usuário tem uma assinatura ativa
 * Este middleware deve ser usado após o middleware de autenticação (protect)
 */
const checkActiveSubscription = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado. Faça login para continuar.'
      });
    }

    const userId = req.user._id;
    const hasActiveSubscription = await Subscription.hasActiveSubscription(userId);

    if (!hasActiveSubscription) {
      return res.status(403).json({
        success: false,
        message: 'Assinatura necessária para acessar este recurso',
        subscriptionRequired: true
      });
    }

    // Adiciona assinatura à requisição para uso posterior
    const subscription = await Subscription.getActiveSubscription(userId);
    req.subscription = subscription;
    
    next();
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status da assinatura'
    });
  }
};

/**
 * Middleware para verificar se o usuário tem acesso a um plano específico
 * Ex: checkPlanAccess(['premium', 'pro'])
 */
const checkPlanAccess = (allowedPlans) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user._id) {
        return res.status(401).json({
          success: false,
          message: 'Acesso não autorizado. Faça login para continuar.'
        });
      }

      const userId = req.user._id;
      const subscription = await Subscription.getActiveSubscription(userId);

      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'Assinatura necessária para acessar este recurso',
          subscriptionRequired: true
        });
      }

      if (!allowedPlans.includes(subscription.plan)) {
        return res.status(403).json({
          success: false,
          message: `Seu plano atual não permite acesso a este recurso. Faça upgrade para ${allowedPlans.join(' ou ')}.`,
          upgradePlanRequired: true,
          currentPlan: subscription.plan,
          requiredPlans: allowedPlans
        });
      }

      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('Erro ao verificar plano de assinatura:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar plano de assinatura'
      });
    }
  };
};

module.exports = {
  checkActiveSubscription,
  checkPlanAccess
}; 