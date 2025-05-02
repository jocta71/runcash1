/**
 * Middleware para verificar se o usuário tem uma assinatura ativa na Asaas
 * Controla acesso aos recursos premium baseado no status da assinatura
 */

const { ObjectId } = require('mongodb');
const getDb = require('../services/database');

/**
 * Verifica o status da assinatura do usuário na Asaas
 * @param {Object} options - Opções de configuração
 * @param {Boolean} options.required - Se a verificação é obrigatória
 * @param {Array} options.allowedPlans - Tipos de plano permitidos
 * @returns {Function} Middleware Express
 */
exports.verifyAsaasSubscription = (options = { required: true, allowedPlans: ['BASIC', 'PREMIUM', 'PRO'] }) => {
  return async (req, res, next) => {
    try {
      // Verificar se o usuário está autenticado
      if (!req.user && !req.usuario) {
        if (options.required) {
          return res.status(401).json({
            success: false,
            message: 'Autenticação necessária para acessar este recurso',
            error: 'AUTH_REQUIRED'
          });
        } else {
          // Autenticação opcional, permitir acesso
          req.hasSubscription = false;
          return next();
        }
      }

      const userId = req.user?.id || req.usuario?.id;
      
      // Se usuário sem ID mas não obrigatório, continuar
      if (!userId && !options.required) {
        req.hasSubscription = false;
        return next();
      }

      // Buscar assinatura ativa no banco de dados
      const db = await getDb();
      
      // Buscar na coleção Subscription
      const userSubscription = await db.collection('Subscription').findOne({
        userId: new ObjectId(userId),
        status: { $in: ['ACTIVE', 'RECEIVED', 'CONFIRMED'] }
      });

      // Se não encontrar na coleção Subscription, verificar na coleção 'subscriptions'
      // para compatibilidade com sistemas existentes
      let subscription = userSubscription;
      if (!subscription) {
        subscription = await db.collection('subscriptions').findOne({
          user_id: userId,
          status: { $in: ['active', 'ACTIVE', 'ativa', 'RECEIVED', 'CONFIRMED'] }
        });
      }

      // Verificar se a assinatura existe e está ativa
      if (!subscription) {
        if (options.required) {
          return res.status(403).json({
            success: false,
            message: 'Você precisa de uma assinatura ativa para acessar este recurso',
            error: 'SUBSCRIPTION_REQUIRED',
            redirectTo: '/planos'
          });
        } else {
          // Assinatura opcional, continuar sem benefícios premium
          req.hasSubscription = false;
          return next();
        }
      }

      // Verificar se o plano é permitido (se especificado)
      if (options.allowedPlans && options.allowedPlans.length > 0) {
        // Tentar determinar o tipo de plano a partir de diferentes campos
        const planType = 
          subscription.planType || 
          subscription.plan_id || 
          subscription.plan || 
          (userSubscription ? 'BASIC' : 'FREE');
        
        // Verificar se o plano está na lista de planos permitidos
        const planAllowed = options.allowedPlans.some(
          plan => planType.toUpperCase() === plan.toUpperCase()
        );
        
        if (!planAllowed) {
          return res.status(403).json({
            success: false,
            message: 'Você precisa de um plano superior para acessar este recurso',
            error: 'PLAN_UPGRADE_REQUIRED',
            currentPlan: planType,
            requiredPlans: options.allowedPlans,
            redirectTo: '/planos'
          });
        }
      }

      // Adicionar informações da assinatura à requisição
      req.subscription = subscription;
      req.hasSubscription = true;
      
      // Continuar para o próximo middleware
      next();
    } catch (error) {
      console.error('Erro ao verificar assinatura Asaas:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar sua assinatura',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  };
};

/**
 * Middleware para obter e adicionar o status da assinatura à requisição,
 * sem bloquear o acesso em caso de assinatura inválida
 */
exports.attachSubscriptionInfo = async (req, res, next) => {
  try {
    // Se não há usuário autenticado, continuar sem verificação
    if (!req.user && !req.usuario) {
      req.hasSubscription = false;
      return next();
    }

    const userId = req.user?.id || req.usuario?.id;
    
    // Buscar assinatura no banco de dados
    const db = await getDb();
    const subscription = await db.collection('Subscription').findOne({
      userId: new ObjectId(userId)
    });

    if (!subscription) {
      // Verificar na coleção 'subscriptions' para compatibilidade
      const legacySubscription = await db.collection('subscriptions').findOne({
        user_id: userId
      });

      if (legacySubscription) {
        req.subscription = legacySubscription;
        req.hasSubscription = ['active', 'ACTIVE', 'ativa', 'RECEIVED', 'CONFIRMED'].includes(legacySubscription.status);
      } else {
        req.hasSubscription = false;
      }
    } else {
      req.subscription = subscription;
      req.hasSubscription = ['ACTIVE', 'RECEIVED', 'CONFIRMED'].includes(subscription.status);
    }

    next();
  } catch (error) {
    console.error('Erro ao obter informações de assinatura:', error);
    // Não bloquear acesso, apenas continuar sem dados de assinatura
    req.hasSubscription = false;
    next();
  }
}; 