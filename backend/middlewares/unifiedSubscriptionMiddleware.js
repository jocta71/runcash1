/**
 * Middleware unificado para verificação de assinatura
 * Consolida as diferentes implementações de verificação de planos e assinaturas
 */

const getDb = require('../services/database');
const ErrorResponse = require('../utils/errorResponse');
const { ObjectId } = require('mongodb');

/**
 * Verifica se o usuário tem uma assinatura ativa
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
exports.verificarAssinatura = async (req, res, next) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user && !req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária para acessar este recurso',
        code: 'AUTH_REQUIRED'
      });
    }

    const userId = req.user?.id || req.usuario?.id;

    // Buscar assinatura ativa no banco de dados
    const db = await getDb();
    const userSubscription = await db.collection('subscriptions').findOne({
      user_id: userId,
      status: { $in: ['active', 'ACTIVE', 'ativa'] }
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
        return res.status(403).json({
          success: false,
          message: 'Você precisa de uma assinatura ativa para acessar este recurso',
          code: 'SUBSCRIPTION_REQUIRED'
        });
      }

      // Adicionar informações da assinatura ao objeto de requisição
      req.subscription = assinatura;
      req.assinatura = assinatura;
      next();
      return;
    }

    // Verificar se a assinatura está expirada
    if (userSubscription.expirationDate && new Date(userSubscription.expirationDate) < new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Sua assinatura expirou. Por favor, renove sua assinatura para continuar',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    // Adicionar informações da assinatura ao objeto de requisição
    req.subscription = userSubscription;
    req.assinatura = userSubscription;
    next();
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar assinatura',
      error: error.message
    });
  }
};

/**
 * Verifica se o usuário possui um plano específico
 * @param {Array} planosPermitidos - Array com os planos permitidos
 */
exports.verificarPlano = (planosPermitidos) => {
  return async (req, res, next) => {
    try {
      // Verificar se o usuário está autenticado
      if (!req.user && !req.usuario) {
        return res.status(401).json({
          success: false,
          message: 'Autenticação necessária para acessar este recurso',
          code: 'AUTH_REQUIRED'
        });
      }

      const userId = req.user?.id || req.usuario?.id;

      // Buscar assinatura ativa no banco de dados
      const db = await getDb();
      const userSubscription = await db.collection('subscriptions').findOne({
        user_id: userId,
        status: { $in: ['active', 'ACTIVE', 'ativa'] }
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
          return res.status(403).json({
            success: false,
            message: 'Você precisa de uma assinatura ativa para acessar este recurso',
            code: 'SUBSCRIPTION_REQUIRED'
          });
        }

        // Verificar se o plano do usuário está entre os permitidos
        if (!planosPermitidos.includes(assinatura.plano)) {
          return res.status(403).json({
            success: false,
            message: `É necessário um plano superior para acessar este recurso. Planos permitidos: ${planosPermitidos.join(', ')}`,
            code: 'PLAN_UPGRADE_REQUIRED'
          });
        }

        // Adicionar informações da assinatura ao objeto de requisição
        req.subscription = assinatura;
        req.assinatura = assinatura;
        next();
        return;
      }

      // Verificar se a assinatura está expirada
      if (userSubscription.expirationDate && new Date(userSubscription.expirationDate) < new Date()) {
        return res.status(403).json({
          success: false,
          message: 'Sua assinatura expirou. Por favor, renove sua assinatura para continuar',
          code: 'SUBSCRIPTION_EXPIRED'
        });
      }

      // Verificar se o plano está entre os permitidos
      if (!planosPermitidos.includes(userSubscription.plan_id)) {
        return res.status(403).json({
          success: false,
          message: `É necessário um plano superior para acessar este recurso. Planos permitidos: ${planosPermitidos.join(', ')}`,
          code: 'PLAN_UPGRADE_REQUIRED'
        });
      }

      // Adicionar informações da assinatura ao objeto de requisição
      req.subscription = userSubscription;
      req.assinatura = userSubscription;
      next();
    } catch (error) {
      console.error('Erro ao verificar plano de assinatura:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar plano de assinatura',
        error: error.message
      });
    }
  };
};

/**
 * Middleware para verificar se o plano do usuário permite acesso a determinado recurso
 * Compatível com a versão antiga que usava resourceType
 * @param {Object} options - Opções de configuração
 */
exports.requireSubscription = (options) => {
  return async (req, res, next) => {
    try {
      // Extrair opções de configuração
      const allowedPlans = options.allowedPlans || [];
      const resourceType = options.resourceType || 'premium_content';

      // Verificar se o usuário está autenticado
      if (!req.user && !req.usuario) {
        return res.status(401).json({
          success: false,
          message: 'Autenticação necessária para acessar este recurso',
          code: 'AUTH_REQUIRED'
        });
      }

      const userId = req.user?.id || req.usuario?.id;

      // Buscar assinatura do usuário
      const db = await getDb();
      const userSubscription = await db.collection('subscriptions').findOne({
        user_id: userId,
        status: { $in: ['active', 'ACTIVE', 'ativa'] }
      });

      // Se não encontrar, verificar se é resource gratuito
      if (!userSubscription) {
        // Verificar em modelos mongoose se não encontrou na collection
        const assinatura = await db.collection('assinaturas').findOne({
          usuario: ObjectId.isValid(userId) ? new ObjectId(userId) : userId,
          status: 'ativa',
          validade: { $gt: new Date() }
        });

        if (!assinatura) {
          // Verificar se o recurso está disponível no plano gratuito
          const freePlan = await db.collection('plans').findOne({ type: 'FREE' });
          if (freePlan && freePlan.allowedFeatures && freePlan.allowedFeatures.includes(resourceType)) {
            req.degradedAccess = true;
            return next();
          }

          return res.status(403).json({
            success: false,
            message: 'Este recurso requer uma assinatura ativa',
            requiredResource: resourceType,
            code: 'SUBSCRIPTION_REQUIRED'
          });
        }

        // Se tem assinatura mongoose, mapear o plano para o formato esperado
        const planoMap = {
          'mensal': 'BASIC',
          'trimestral': 'PRO',
          'anual': 'PREMIUM'
        };

        // Verificar se o plano está entre os permitidos
        if (allowedPlans.length > 0 && !allowedPlans.includes(planoMap[assinatura.plano])) {
          return res.status(403).json({
            success: false,
            message: `É necessário um plano superior para acessar este recurso`,
            currentPlan: assinatura.plano,
            requiredResource: resourceType,
            code: 'PLAN_UPGRADE_REQUIRED'
          });
        }

        req.subscription = assinatura;
        req.assinatura = assinatura;
        return next();
      }

      // Verificar se a assinatura está expirada
      if (userSubscription.expirationDate && new Date(userSubscription.expirationDate) < new Date()) {
        return res.status(403).json({
          success: false,
          message: 'Sua assinatura expirou. Por favor, renove sua assinatura para continuar',
          code: 'SUBSCRIPTION_EXPIRED'
        });
      }

      // Verificar se o plano está entre os permitidos ou tem acesso ao recurso
      if (allowedPlans.length > 0 && !allowedPlans.includes(userSubscription.plan_id)) {
        // Buscar o plano do usuário para verificar os recursos
        const userPlan = await db.collection('plans').findOne({
          id: userSubscription.plan_id
        });

        // Se o plano permite o recurso específico, permitir acesso
        if (userPlan && userPlan.allowedFeatures && userPlan.allowedFeatures.includes(resourceType)) {
          req.subscription = userSubscription;
          req.userPlan = userPlan;
          req.assinatura = userSubscription;
          return next();
        }

        // Caso contrário, negar acesso
        return res.status(403).json({
          success: false,
          message: 'Seu plano atual não permite acesso a este recurso',
          currentPlan: userPlan?.name || userSubscription.plan_id,
          requiredResource: resourceType,
          code: 'PLAN_UPGRADE_REQUIRED'
        });
      }

      // Armazenar o plano e a assinatura no objeto de requisição para uso posterior
      req.subscription = userSubscription;
      req.assinatura = userSubscription;

      // Buscar mais detalhes do plano
      const userPlan = await db.collection('plans').findOne({
        id: userSubscription.plan_id
      });
      req.userPlan = userPlan;

      // Tudo certo, prosseguir
      next();
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar permissões de assinatura',
        code: 'SERVER_ERROR'
      });
    }
  };
}; 