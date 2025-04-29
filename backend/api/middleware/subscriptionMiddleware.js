/**
 * Middleware para verificar assinaturas e controlar acesso a recursos
 */

const getDb = require('../utils/db');
const { ObjectId } = require('mongodb');

/**
 * Verifica se o usuário tem uma assinatura ativa
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.required - Se a assinatura é obrigatória (padrão: true)
 * @param {Array} options.allowedPlans - Lista de planos permitidos (opcional)
 * @returns {Function} Middleware Express
 */
exports.requireSubscription = (options = { required: true }) => {
  return async (req, res, next) => {
    try {
      // Verificar se o usuário está autenticado
      if (!req.user && !req.userId) {
        if (options.required) {
          return res.status(401).json({
            success: false,
            message: 'Autenticação necessária para acessar este recurso',
            error: 'AUTH_REQUIRED'
          });
        } else {
          // Autenticação opcional, permitir acesso mesmo sem usuário
          return next();
        }
      }

      const userId = req.user?.id || req.userId;
      
      // Se sem usuário mas não obrigatório, continuar
      if (!userId && !options.required) {
        return next();
      }

      // Buscar assinatura ativa no banco de dados
      const db = await getDb();
      const userSubscription = await db.collection('subscriptions').findOne({
        user_id: userId,
        status: { $in: ['active', 'ACTIVE', 'ativa'] }
      });

      // Verificar se a assinatura existe e está ativa
      if (!userSubscription) {
        if (options.required) {
          return res.status(403).json({
            success: false,
            message: 'Você precisa de uma assinatura ativa para acessar este recurso',
            error: 'SUBSCRIPTION_REQUIRED'
          });
        } else {
          // Assinatura opcional, continuar sem benefícios premium
          req.hasSubscription = false;
          return next();
        }
      }

      // Verificar se a assinatura está expirada
      if (userSubscription.expirationDate && new Date(userSubscription.expirationDate) < new Date()) {
        if (options.required) {
          return res.status(403).json({
            success: false,
            message: 'Sua assinatura expirou. Por favor, renove sua assinatura para continuar',
            error: 'SUBSCRIPTION_EXPIRED'
          });
        } else {
          // Expirada mas não obrigatória, continuar sem benefícios premium
          req.hasSubscription = false;
          return next();
        }
      }

      // Verificar se o plano é permitido (se especificado)
      if (options.allowedPlans && options.allowedPlans.length > 0) {
        const userPlan = userSubscription.plan_id;
        
        if (!options.allowedPlans.includes(userPlan)) {
          return res.status(403).json({
            success: false,
            message: `Acesso negado. Este recurso requer um plano superior`,
            error: 'PLAN_UPGRADE_REQUIRED',
            currentPlan: userPlan,
            requiredPlans: options.allowedPlans
          });
        }
      }

      // Adicionar informações da assinatura ao objeto de requisição
      req.subscription = userSubscription;
      req.hasSubscription = true;
      next();
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar assinatura',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  };
};

/**
 * Verifica se o usuário tem acesso a determinado recurso
 * @param {String} resourceType - Tipo de recurso que requer verificação
 * @returns {Function} Middleware Express
 */
exports.requireResourceAccess = (resourceType) => {
  return async (req, res, next) => {
    try {
      // Verificar se a assinatura está presente
      if (!req.hasSubscription || !req.subscription) {
        return res.status(403).json({
          success: false,
          message: 'Assinatura necessária para acessar este recurso',
          error: 'SUBSCRIPTION_REQUIRED'
        });
      }

      // Mapeamento de recursos por plano
      const resourceAccessMap = {
        'BASIC': ['basic_data', 'standard_stats'],
        'PRO': ['basic_data', 'standard_stats', 'advanced_stats', 'real_time_data'],
        'PREMIUM': ['basic_data', 'standard_stats', 'advanced_stats', 'real_time_data', 'historical_data', 'api_access']
      };

      // Verificar se o plano do usuário permite acesso ao recurso
      const planResources = resourceAccessMap[req.subscription.plan_id] || [];
      
      if (!planResources.includes(resourceType)) {
        return res.status(403).json({
          success: false,
          message: `Acesso negado. Este recurso requer um plano superior`,
          error: 'RESOURCE_NOT_ALLOWED',
          currentPlan: req.subscription.plan_id,
          requestedResource: resourceType
        });
      }

      // Se chegou aqui, o usuário tem acesso ao recurso
      next();
    } catch (error) {
      console.error('Erro na verificação de acesso a recurso:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Erro interno durante verificação de acesso a recurso',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  };
}; 