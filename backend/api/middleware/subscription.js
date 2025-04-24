const axios = require('axios');
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

/**
 * Middleware para verificar se o usuário tem acesso a determinados recursos com base no plano
 * Este middleware deve ser usado após o middleware auth.protect
 */
exports.hasFeatureAccess = (featureId) => {
  return async (req, res, next) => {
    try {
      // Verificar se o usuário está autenticado
      if (!req.user || !req.user.id) {
        console.log(`[subscription.js] Acesso a feature '${featureId}' negado: usuário não autenticado`);
        return res.status(401).json({
          success: false,
          error: 'Não autorizado para acessar este recurso',
          featureId: featureId
        });
      }

      // Obter o usuário do banco de dados para verificar informações adicionais
      const db = getDb();
      const userId = req.user.id.startsWith('ObjectId') 
        ? ObjectId(req.user.id.substring(9, req.user.id.length - 2)) 
        : req.user.id;

      console.log(`[subscription.js] Verificando acesso a feature '${featureId}' para usuário ID: ${userId}`);
      
      // Buscar usuário no banco de dados
      const user = await db.collection('users').findOne({ _id: userId });
      
      if (!user) {
        console.log(`[subscription.js] Usuário não encontrado no banco de dados: ${userId}`);
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado',
          featureId: featureId
        });
      }

      // Verificar se o usuário é admin (admins têm acesso a tudo)
      if (user.isAdmin || user.role === 'admin') {
        console.log(`[subscription.js] Acesso concedido para '${featureId}': usuário é admin`);
        return next();
      }

      // Buscar assinatura do usuário via Asaas
      const asaasCustomerId = user.asaasCustomerId;
      
      if (!asaasCustomerId) {
        console.log(`[subscription.js] Usuário ${userId} não tem asaasCustomerId, usando plano FREE`);
        // Verificar se feature está disponível no plano FREE
        const hasAccess = isFreeFeature(featureId);
        
        if (hasAccess) {
          console.log(`[subscription.js] Acesso concedido para '${featureId}': recurso disponível no plano FREE`);
          return next();
        } else {
          console.log(`[subscription.js] Acesso negado para '${featureId}': recurso não disponível no plano FREE`);
          return res.status(403).json({
            success: false,
            error: 'Recurso disponível apenas para assinantes',
            featureId: featureId,
            requiredPlan: 'BASIC'
          });
        }
      }

      // Usuário tem ID no Asaas, verificar suas assinaturas
      try {
        const asaasApiKey = process.env.ASAAS_API_KEY;
        const asaasUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
        
        const subscriptionsResponse = await axios.get(
          `${asaasUrl}/subscriptions?customer=${asaasCustomerId}&includeDeleted=false`, 
          { headers: { access_token: asaasApiKey } }
        );
        
        const subscriptions = subscriptionsResponse.data.data;
        
        // Verificar se existe alguma assinatura ativa
        const activeSubscription = subscriptions.find(sub => 
          sub.status === 'ACTIVE' || sub.status === 'ACTIVE'
        );
        
        if (!activeSubscription) {
          console.log(`[subscription.js] Usuário ${userId} não tem assinatura ativa, usando plano FREE`);
          // Verificar se feature está disponível no plano FREE
          const hasAccess = isFreeFeature(featureId);
          
          if (hasAccess) {
            console.log(`[subscription.js] Acesso concedido para '${featureId}': recurso disponível no plano FREE`);
            return next();
          } else {
            console.log(`[subscription.js] Acesso negado para '${featureId}': recurso requer assinatura ativa`);
            return res.status(403).json({
              success: false,
              error: 'Recurso disponível apenas para assinantes com plano ativo',
              featureId: featureId,
              requiredPlan: 'BASIC'
            });
          }
        }
        
        // Determinar o plano com base no valor da assinatura
        let planType;
        const value = activeSubscription.value;
        
        if (value >= 99) {
          planType = 'PREMIUM';
        } else if (value >= 49) {
          planType = 'PRO';
        } else if (value >= 19) {
          planType = 'BASIC';
        } else {
          planType = 'FREE';
        }
        
        console.log(`[subscription.js] Usuário ${userId} tem plano ${planType} (valor: ${value})`);
        
        // Verificar se o recurso está disponível para este plano
        const hasAccess = checkFeatureAccess(featureId, planType);
        
        if (hasAccess) {
          console.log(`[subscription.js] Acesso concedido para '${featureId}': recurso disponível no plano ${planType}`);
          
          // Adicionar informações do plano à requisição para uso em outros middlewares ou controladores
          req.subscription = {
            planType,
            subscriptionId: activeSubscription.id,
            isActive: true
          };
          
          return next();
        } else {
          console.log(`[subscription.js] Acesso negado para '${featureId}': recurso não disponível no plano ${planType}`);
          
          // Determinar qual plano é necessário para esta feature
          const requiredPlan = getRequiredPlanForFeature(featureId);
          
          return res.status(403).json({
            success: false,
            error: 'Recurso não disponível no seu plano atual',
            featureId: featureId,
            currentPlan: planType,
            requiredPlan: requiredPlan
          });
        }
      } catch (error) {
        console.error(`[subscription.js] Erro ao verificar assinatura no Asaas:`, error);
        
        // Se houve erro na verificação, negar acesso por segurança
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar assinatura',
          featureId: featureId
        });
      }
    } catch (error) {
      console.error(`[subscription.js] Erro no middleware de verificação de assinatura:`, error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar permissões de assinatura',
        featureId: featureId
      });
    }
  };
};

// Função auxiliar para verificar se uma feature está disponível no plano FREE
function isFreeFeature(featureId) {
  // Lista de features disponíveis no plano gratuito
  const freeFeatures = ['basic_stats', 'view_home_content'];
  
  return freeFeatures.includes(featureId);
}

// Função auxiliar para verificar se uma feature está disponível em um determinado plano
function checkFeatureAccess(featureId, planType) {
  // Mapeamento de features por plano
  const featuresByPlan = {
    'FREE': ['basic_stats', 'view_home_content'],
    
    'BASIC': [
      'basic_stats', 'view_home_content',
      'view_roulette_cards', 'view_roulette_sidepanel',
      'basic_notifications'
    ],
    
    'PRO': [
      'basic_stats', 'view_home_content',
      'view_roulette_cards', 'view_roulette_sidepanel',
      'basic_notifications', 'advanced_stats',
      'trend_detection', 'prediction_tools'
    ],
    
    'PREMIUM': [
      'basic_stats', 'view_home_content',
      'view_roulette_cards', 'view_roulette_sidepanel',
      'basic_notifications', 'advanced_stats',
      'trend_detection', 'prediction_tools',
      'api_access', 'vip_support',
      'custom_alerts', 'data_export'
    ]
  };
  
  // Verificar se a feature está disponível no plano
  if (featuresByPlan[planType] && featuresByPlan[planType].includes(featureId)) {
    return true;
  }
  
  return false;
}

// Função para determinar qual plano é necessário para uma feature específica
function getRequiredPlanForFeature(featureId) {
  // Mapeamento inverso: feature -> plano mínimo necessário
  const requiredPlanForFeature = {
    'basic_stats': 'FREE',
    'view_home_content': 'FREE',
    'view_roulette_cards': 'BASIC',
    'view_roulette_sidepanel': 'BASIC',
    'basic_notifications': 'BASIC',
    'advanced_stats': 'PRO',
    'trend_detection': 'PRO',
    'prediction_tools': 'PRO',
    'api_access': 'PREMIUM',
    'vip_support': 'PREMIUM',
    'custom_alerts': 'PREMIUM',
    'data_export': 'PREMIUM'
  };
  
  return requiredPlanForFeature[featureId] || 'PREMIUM';
} 