/**
 * Controlador para gerenciar verificações de assinatura e permissões
 */

const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

/**
 * Verifica se o usuário tem acesso a um recurso específico
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 */
exports.checkFeatureAccess = async (req, res) => {
  try {
    const featureId = req.params.featureId;
    const userId = req.user?.id || req.usuario?.id;

    if (!featureId) {
      return res.status(400).json({
        success: false,
        message: 'ID do recurso não fornecido',
        code: 'INVALID_FEATURE_ID'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        code: 'AUTH_REQUIRED'
      });
    }

    const db = await getDb();

    // Buscar assinatura do usuário
    const userSubscription = await db.collection('subscriptions').findOne({
      user_id: userId,
      status: { $in: ['active', 'ACTIVE', 'ativa'] }
    });

    // Verificar no formato antigo (mongoose) se não encontrou no formato novo
    let userPlan = null;
    let userPlanType = 'FREE';
    let hasAccess = false;

    if (!userSubscription) {
      // Verificar em modelos mongoose
      const assinatura = await db.collection('assinaturas').findOne({
        usuario: ObjectId.isValid(userId) ? new ObjectId(userId) : userId,
        status: 'ativa',
        validade: { $gt: new Date() }
      });

      if (!assinatura) {
        // Verificar se o recurso está disponível no plano gratuito
        const freePlan = await db.collection('plans').findOne({ type: 'FREE' });
        
        if (freePlan && freePlan.allowedFeatures && freePlan.allowedFeatures.includes(featureId)) {
          return res.status(200).json({
            success: true,
            hasAccess: true,
            planType: 'FREE',
            message: 'Acesso permitido no plano gratuito'
          });
        }

        return res.status(200).json({
          success: true,
          hasAccess: false,
          planType: 'FREE',
          message: 'Este recurso requer uma assinatura ativa'
        });
      }

      // Mapear plano mongoose para o formato de plano
      const planoMap = {
        'mensal': 'BASIC',
        'trimestral': 'PRO',
        'anual': 'PREMIUM'
      };

      userPlanType = planoMap[assinatura.plano] || 'FREE';

      // Verificar acesso com base no tipo de plano
      const plansByType = {
        'PREMIUM': await db.collection('plans').findOne({ type: 'PREMIUM' }),
        'PRO': await db.collection('plans').findOne({ type: 'PRO' }),
        'BASIC': await db.collection('plans').findOne({ type: 'BASIC' }),
        'FREE': await db.collection('plans').findOne({ type: 'FREE' })
      };

      userPlan = plansByType[userPlanType];
      
      if (userPlan && userPlan.allowedFeatures) {
        hasAccess = userPlan.allowedFeatures.includes(featureId);
      }
    } else {
      // Verificar se a assinatura está expirada
      if (userSubscription.expirationDate && new Date(userSubscription.expirationDate) < new Date()) {
        return res.status(200).json({
          success: true,
          hasAccess: false,
          planType: 'FREE',
          message: 'Sua assinatura expirou'
        });
      }

      // Buscar plano do usuário
      const plan = await db.collection('plans').findOne({
        id: userSubscription.plan_id
      });

      if (plan) {
        userPlan = plan;
        userPlanType = plan.type;
        hasAccess = plan.allowedFeatures && plan.allowedFeatures.includes(featureId);
      }
    }

    // Se não encontrou nenhum plano ou acesso
    if (!userPlan) {
      return res.status(200).json({
        success: true,
        hasAccess: false,
        planType: 'FREE',
        message: 'Não foi possível determinar o plano do usuário'
      });
    }

    return res.status(200).json({
      success: true,
      hasAccess: hasAccess,
      planType: userPlanType,
      message: hasAccess 
        ? `Acesso permitido no plano ${userPlanType}` 
        : `Acesso negado para o recurso no plano ${userPlanType}`
    });
  } catch (error) {
    console.error('Erro ao verificar acesso a recurso:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar permissões de acesso',
      error: error.message
    });
  }
};

/**
 * Lista todos os recursos disponíveis para o usuário
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 */
exports.listAvailableFeatures = async (req, res) => {
  try {
    const userId = req.user?.id || req.usuario?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        code: 'AUTH_REQUIRED'
      });
    }

    const db = await getDb();

    // Buscar assinatura do usuário
    const userSubscription = await db.collection('subscriptions').findOne({
      user_id: userId,
      status: { $in: ['active', 'ACTIVE', 'ativa'] }
    });

    let userPlanType = 'FREE';
    let availableFeatures = [];

    // Verificar no formato antigo (mongoose) se não encontrou no formato novo
    if (!userSubscription) {
      // Verificar em modelos mongoose
      const assinatura = await db.collection('assinaturas').findOne({
        usuario: ObjectId.isValid(userId) ? new ObjectId(userId) : userId,
        status: 'ativa',
        validade: { $gt: new Date() }
      });

      if (assinatura) {
        // Mapear plano mongoose para o formato de plano
        const planoMap = {
          'mensal': 'BASIC',
          'trimestral': 'PRO',
          'anual': 'PREMIUM'
        };

        userPlanType = planoMap[assinatura.plano] || 'FREE';
      }
    } else {
      // Verificar se a assinatura está expirada
      if (userSubscription.expirationDate && new Date(userSubscription.expirationDate) < new Date()) {
        userPlanType = 'FREE';
      } else {
        // Buscar plano do usuário
        const plan = await db.collection('plans').findOne({
          id: userSubscription.plan_id
        });

        if (plan) {
          userPlanType = plan.type;
        }
      }
    }

    // Buscar recursos disponíveis com base no tipo de plano
    const plans = await db.collection('plans').find().toArray();
    
    // Encontrar todos os recursos disponíveis para o usuário
    for (const plan of plans) {
      // Se o plano é igual ou inferior ao plano do usuário
      if (isEqualOrInferiorPlan(plan.type, userPlanType) && plan.allowedFeatures) {
        // Adicionar features que ainda não estão na lista
        for (const feature of plan.allowedFeatures) {
          if (!availableFeatures.includes(feature)) {
            availableFeatures.push(feature);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      planType: userPlanType,
      availableFeatures: availableFeatures,
      message: `Recursos disponíveis para o plano ${userPlanType}`
    });
  } catch (error) {
    console.error('Erro ao listar recursos disponíveis:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar recursos disponíveis',
      error: error.message
    });
  }
};

/**
 * Verifica se um plano é igual ou inferior a outro
 * @param {string} planToCheck - Plano a ser verificado
 * @param {string} userPlan - Plano do usuário
 * @returns {boolean} - True se o plano for igual ou inferior
 */
function isEqualOrInferiorPlan(planToCheck, userPlan) {
  const hierarchy = {
    'FREE': 1,
    'BASIC': 2,
    'PRO': 3,
    'PREMIUM': 4
  };

  return hierarchy[planToCheck] <= hierarchy[userPlan];
} 