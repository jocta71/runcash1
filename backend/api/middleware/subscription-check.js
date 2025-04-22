const verifySubscriptionStatus = require('../payment/verify-subscription-status');
const logger = require('../utils/logger');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { StatusError } = require('../utils/errors');

/**
 * Verifica o status atual da assinatura de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Objeto contendo informações da assinatura
 */
async function checkSubscriptionStatus(userId) {
  try {
    // Buscar assinatura do usuário
    const subscription = await Subscription.findOne({ userId }).sort({ createdAt: -1 });
    
    if (!subscription) {
      return { active: false, status: 'none', plan: null };
    }

    // Verificar se a assinatura está ativa
    const now = new Date();
    const isActive = subscription.status === 'active' && 
                    subscription.endDate && 
                    new Date(subscription.endDate) > now;
    
    const isPending = subscription.status === 'pending';
    const isCancelled = subscription.status === 'cancelled';
    const isExpired = subscription.endDate && new Date(subscription.endDate) <= now;
    
    // Determinar status final
    let status = subscription.status;
    if (status === 'active' && isExpired) {
      status = 'expired';
    }

    return {
      active: isActive,
      pending: isPending,
      status,
      plan: subscription.plan,
      endDate: subscription.endDate,
      startDate: subscription.startDate,
      daysLeft: isActive ? 
        Math.ceil((new Date(subscription.endDate) - now) / (1000 * 60 * 60 * 24)) : 
        0
    };
  } catch (error) {
    logger.error(`Erro ao verificar status da assinatura: ${error.message}`, {
      userId,
      error: error.stack
    });
    return { active: false, status: 'error', plan: null };
  }
}

/**
 * Middleware para verificação de assinatura
 * Contém funcionalidades para verificar o status da assinatura do usuário
 * e proteger rotas que requerem assinatura ativa
 */
module.exports = {
  /**
   * Middleware que exige assinatura ativa para acessar a rota
   */
  requireActiveSubscription: async (req, res, next) => {
    try {
      // Verifica se o usuário está autenticado
      if (!req.user || !req.user.id) {
        throw new StatusError('Usuário não autenticado', 401);
      }

      // Verificar status da assinatura
      const subscriptionStatus = await checkSubscriptionStatus(req.user.id);
      
      // Adiciona informações de assinatura à requisição
      req.subscriptionStatus = subscriptionStatus;
      
      // Verifica se a assinatura está ativa
      if (!subscriptionStatus.active) {
        throw new StatusError(
          'Acesso negado: é necessária uma assinatura ativa para acessar este recurso', 
          403,
          { 
            code: 'SUBSCRIPTION_REQUIRED',
            subscriptionStatus 
          }
        );
      }

      next();
    } catch (error) {
      logger.warn(`Acesso negado por assinatura inativa: ${error.message}`, {
        userId: req.user?.id,
        path: req.path,
        subscriptionStatus: req.subscriptionStatus
      });
      
      if (error instanceof StatusError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code || 'ERROR',
          data: error.data
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar assinatura',
        code: 'SUBSCRIPTION_CHECK_ERROR'
      });
    }
  },

  /**
   * Middleware que permite acesso se a assinatura estiver pendente ou ativa
   */
  allowPendingSubscription: async (req, res, next) => {
    try {
      // Verifica se o usuário está autenticado
      if (!req.user || !req.user.id) {
        throw new StatusError('Usuário não autenticado', 401);
      }

      // Verificar status da assinatura
      const subscriptionStatus = await checkSubscriptionStatus(req.user.id);
      
      // Adiciona informações de assinatura à requisição
      req.subscriptionStatus = subscriptionStatus;
      
      // Verifica se a assinatura está ativa ou pendente
      if (!subscriptionStatus.active && !subscriptionStatus.pending) {
        throw new StatusError(
          'Acesso negado: é necessária uma assinatura ativa ou pendente para acessar este recurso', 
          403,
          { 
            code: 'SUBSCRIPTION_REQUIRED',
            subscriptionStatus 
          }
        );
      }

      next();
    } catch (error) {
      logger.warn(`Acesso negado por assinatura inativa/não pendente: ${error.message}`, {
        userId: req.user?.id,
        path: req.path,
        subscriptionStatus: req.subscriptionStatus
      });
      
      if (error instanceof StatusError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code || 'ERROR',
          data: error.data
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar assinatura',
        code: 'SUBSCRIPTION_CHECK_ERROR'
      });
    }
  },

  /**
   * Middleware que apenas adiciona informações de assinatura à requisição
   * sem bloquear o acesso
   */
  addSubscriptionInfo: async (req, res, next) => {
    try {
      // Se o usuário não estiver autenticado, continua sem adicionar informações
      if (!req.user || !req.user.id) {
        return next();
      }

      // Verificar status da assinatura
      const subscriptionStatus = await checkSubscriptionStatus(req.user.id);
      
      // Adiciona informações de assinatura à requisição
      req.subscriptionStatus = subscriptionStatus;
      
      next();
    } catch (error) {
      logger.error(`Erro ao obter informações de assinatura: ${error.message}`, {
        userId: req.user?.id,
        path: req.path,
        error: error.stack
      });
      
      // Não bloqueia o acesso, apenas continua sem as informações de assinatura
      next();
    }
  },

  /**
   * Função para verificar status da assinatura
   * Exportada para uso em outros módulos
   */
  checkSubscriptionStatus
}; 