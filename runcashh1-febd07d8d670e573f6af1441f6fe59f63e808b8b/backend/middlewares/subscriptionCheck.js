/**
 * Middleware para verificar se o usuário tem uma assinatura válida 
 * que permite acesso a determinados recursos premium
 */

const { ObjectId } = require('mongodb');
const getDb = require('../services/database');
const ErrorResponse = require('../utils/errorResponse');

/**
 * Verifica se o usuário tem acesso a um recurso específico com base no seu plano
 * @param {Object} options - Opções de configuração 
 * @param {Array} options.allowedPlans - Lista de planos permitidos para acessar o recurso
 * @param {String} options.resourceType - Tipo de recurso a ser acessado
 * @returns {Function} Middleware do Express
 */
exports.requireSubscription = (options) => {
  return async (req, res, next) => {
    try {
      // Extrair opções de configuração
      const allowedPlans = options.allowedPlans || [];
      const resourceType = options.resourceType || 'premium_content';

      // Verificar se o usuário está autenticado
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Autenticação necessária para acessar este recurso',
          code: 'AUTH_REQUIRED'
        });
      }

      // Buscar assinatura do usuário no banco de dados
      const db = await getDb();
      const userSubscription = await db.collection('subscriptions').findOne({
        user_id: req.user.id,
        status: { $in: ['active', 'ACTIVE'] } // Apenas status ativos são aceitos
      });

      // Se não tiver assinatura ativa, verificar se o recurso é gratuito
      if (!userSubscription) {
        const freePlan = await db.collection('plans').findOne({ type: 'FREE' });
        
        // Se o plano gratuito permitir este recurso, seguir em frente
        if (freePlan && freePlan.allowedFeatures && freePlan.allowedFeatures.includes(resourceType)) {
          return next();
        }
        
        // Caso contrário, bloquear o acesso
        return res.status(403).json({
          success: false,
          message: 'Este recurso requer uma assinatura ativa',
          requiredResource: resourceType,
          code: 'SUBSCRIPTION_REQUIRED'
        });
      }

      // Verificar data de expiração da assinatura
      if (userSubscription.expirationDate && new Date(userSubscription.expirationDate) < new Date()) {
        return res.status(403).json({
          success: false,
          message: 'Sua assinatura expirou. Por favor, renove sua assinatura para continuar',
          code: 'SUBSCRIPTION_EXPIRED'
        });
      }

      // Verificar se o plano do usuário está na lista de planos permitidos
      if (allowedPlans.length > 0 && !allowedPlans.includes(userSubscription.plan_id)) {
        // Buscar o plano correspondente à assinatura
        const userPlan = await db.collection('plans').findOne({
          id: userSubscription.plan_id
        });

        // Buscar detalhes do plano atual
        const planName = userPlan ? userPlan.name : userSubscription.plan_id;

        // Verificar se o plano permite acesso ao recurso
        if (userPlan && userPlan.allowedFeatures && userPlan.allowedFeatures.includes(resourceType)) {
          // Se o plano permite o recurso, mesmo que não esteja na lista de planos permitidos, permitir o acesso
          req.subscription = userSubscription;
          req.userPlan = userPlan;
          return next();
        }
        
        // Buscar planos que permitem o recurso para sugerir upgrade
        const upgradePlans = await db.collection('plans')
          .find({ 
            allowedFeatures: { $in: [resourceType] },
            id: { $in: allowedPlans } 
          })
          .toArray();
        
        return res.status(403).json({
          success: false,
          message: 'Seu plano atual não permite acesso a este recurso',
          currentPlan: planName,
          requiredResource: resourceType,
          suggestedPlans: upgradePlans.map(plan => plan.name).join(', '),
          code: 'PLAN_UPGRADE_REQUIRED'
        });
      }

      // Armazenar o plano e a assinatura no objeto de requisição para uso posterior
      req.subscription = userSubscription;
      
      // Buscar mais detalhes do plano se necessário
      if (!req.userPlan) {
        const userPlan = await db.collection('plans').findOne({
          id: userSubscription.plan_id
        });
        req.userPlan = userPlan;
      }
      
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