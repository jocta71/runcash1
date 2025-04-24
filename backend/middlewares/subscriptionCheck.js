/**
 * Middleware para verificar se o usuário tem uma assinatura válida 
 * que permite acesso a determinados recursos premium
 */

const { ObjectId } = require('mongodb');
const getDb = require('../services/database');

/**
 * Verifica se o usuário tem acesso a um recurso específico com base no seu plano
 * @param {string} resource - ID do recurso a ser verificado (ex: 'view_roulette_sidepanel')
 * @returns {Function} Middleware do Express
 */
const requireSubscription = (resource) => {
  return async (req, res, next) => {
    try {
      // Verificar se o usuário está autenticado
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Autenticação necessária',
          code: 'AUTH_REQUIRED'
        });
      }

      // Se o recurso não for especificado, permitir o acesso (fallback seguro)
      if (!resource) {
        return next();
      }

      // Buscar assinatura do usuário no banco de dados
      const db = await getDb();
      const userSubscription = await db.collection('subscriptions').findOne({
        user_id: req.user.id,
        status: { $in: ['active', 'ACTIVE', 'pending', 'PENDING'] } // Aceitar status ativos e pendentes
      });

      // Se não tiver assinatura, verificar se o recurso é gratuito
      if (!userSubscription) {
        const freePlan = await db.collection('plans').findOne({ type: 'FREE' });
        
        // Se o plano gratuito permitir este recurso, ou se não encontramos o plano (fallback seguro)
        if (!freePlan || (freePlan.allowedFeatures && freePlan.allowedFeatures.includes(resource))) {
          return next();
        }
        
        return res.status(403).json({
          success: false,
          message: 'Este recurso requer uma assinatura ativa',
          requiredResource: resource,
          code: 'SUBSCRIPTION_REQUIRED'
        });
      }

      // Buscar o plano correspondente à assinatura
      const plan = await db.collection('plans').findOne({
        id: userSubscription.plan_id
      });

      // Verificar se o plano existe e permite o recurso solicitado
      if (!plan || !plan.allowedFeatures || !plan.allowedFeatures.includes(resource)) {
        return res.status(403).json({
          success: false,
          message: 'Seu plano atual não permite acesso a este recurso',
          currentPlan: plan?.name || 'Desconhecido',
          requiredResource: resource,
          code: 'PLAN_UPGRADE_REQUIRED'
        });
      }

      // Armazenar o plano e a assinatura no objeto de requisição para uso posterior
      req.subscription = userSubscription;
      req.userPlan = plan;
      
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

module.exports = { requireSubscription }; 