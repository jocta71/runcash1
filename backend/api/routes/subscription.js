const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { hasFeatureAccess } = require('../middleware/subscription');
const { PlanType } = require('../types/plans');
const { getDb } = require('../config/db');
const axios = require('axios');

/**
 * @route   GET /api/subscription/check-access/:featureId
 * @desc    Verifica se o usuário tem acesso a um recurso específico
 * @access  Privado (requer autenticação)
 */
router.get('/check-access/:featureId', protect, async (req, res) => {
  try {
    const featureId = req.params.featureId;
    
    // Obter usuário do banco de dados
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: req.user.id });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Verificar se o usuário é admin (admins têm acesso a tudo)
    if (user.isAdmin || user.role === 'admin') {
      return res.status(200).json({
        success: true,
        hasAccess: true,
        featureId,
        planType: 'ADMIN',
        message: 'Acesso de administrador concedido'
      });
    }

    // Verificar assinatura do usuário via Asaas
    let planType = 'FREE';
    let hasAccess = false;
    let message = '';

    // Se não tem ID do Asaas, verificar plano FREE
    if (!user.asaasCustomerId) {
      hasAccess = isFreeFeature(featureId);
      message = hasAccess 
        ? 'Recurso disponível no plano gratuito' 
        : 'Recurso disponível apenas para assinantes';
    } else {
      // Buscar assinaturas do usuário
      try {
        const asaasApiKey = process.env.ASAAS_API_KEY;
        const asaasUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
        
        const subscriptionsResponse = await axios.get(
          `${asaasUrl}/subscriptions?customer=${user.asaasCustomerId}&includeDeleted=false`, 
          { headers: { access_token: asaasApiKey } }
        );
        
        const subscriptions = subscriptionsResponse.data.data;
        
        // Verificar se existe alguma assinatura ativa
        const activeSubscription = subscriptions.find(sub => 
          sub.status === 'ACTIVE' || sub.status === 'ACTIVE'
        );
        
        if (!activeSubscription) {
          hasAccess = isFreeFeature(featureId);
          message = hasAccess 
            ? 'Recurso disponível no plano gratuito' 
            : 'Recurso disponível apenas para assinantes com plano ativo';
        } else {
          // Determinar o plano com base no valor da assinatura
          const value = activeSubscription.value;
          
          if (value >= 99) {
            planType = 'PREMIUM';
          } else if (value >= 49) {
            planType = 'PRO';
          } else if (value >= 19) {
            planType = 'BASIC';
          }
          
          // Verificar se o recurso está disponível para este plano
          hasAccess = checkFeatureAccess(featureId, planType);
          
          if (hasAccess) {
            message = `Recurso disponível no plano ${planType}`;
          } else {
            const requiredPlan = getRequiredPlanForFeature(featureId);
            message = `Recurso disponível apenas no plano ${requiredPlan} ou superior`;
          }
        }
      } catch (error) {
        console.error('Erro ao verificar assinatura:', error);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar assinatura',
          featureId
        });
      }
    }

    return res.status(200).json({
      success: true,
      hasAccess,
      featureId,
      planType,
      message,
      requiredPlan: getRequiredPlanForFeature(featureId)
    });
  } catch (error) {
    console.error('Erro ao verificar acesso a recurso:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar acesso a recurso'
    });
  }
});

/**
 * @route   GET /api/subscription/current-plan
 * @desc    Obtém o plano atual do usuário
 * @access  Privado (requer autenticação)
 */
router.get('/current-plan', protect, async (req, res) => {
  try {
    // Obter usuário do banco de dados
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: req.user.id });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Verificar se o usuário é admin
    if (user.isAdmin || user.role === 'admin') {
      return res.status(200).json({
        success: true,
        planType: 'ADMIN',
        isActive: true,
        features: getAllFeatures()
      });
    }

    // Determinar o plano com base na assinatura do Asaas
    let planType = 'FREE';
    let isActive = false;
    let subscriptionId = null;
    let nextBillingDate = null;
    let features = [];

    // Se não tem ID do Asaas, usar plano FREE
    if (!user.asaasCustomerId) {
      features = getFeaturesForPlan('FREE');
    } else {
      // Buscar assinaturas do usuário
      try {
        const asaasApiKey = process.env.ASAAS_API_KEY;
        const asaasUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
        
        const subscriptionsResponse = await axios.get(
          `${asaasUrl}/subscriptions?customer=${user.asaasCustomerId}&includeDeleted=false`, 
          { headers: { access_token: asaasApiKey } }
        );
        
        const subscriptions = subscriptionsResponse.data.data;
        
        // Verificar se existe alguma assinatura ativa
        const activeSubscription = subscriptions.find(sub => 
          sub.status === 'ACTIVE' || sub.status === 'ACTIVE'
        );
        
        if (!activeSubscription) {
          // Usuário sem assinatura ativa, usar plano FREE
          features = getFeaturesForPlan('FREE');
        } else {
          // Determinar o plano com base no valor da assinatura
          const value = activeSubscription.value;
          
          if (value >= 99) {
            planType = 'PREMIUM';
          } else if (value >= 49) {
            planType = 'PRO';
          } else if (value >= 19) {
            planType = 'BASIC';
          }
          
          isActive = true;
          subscriptionId = activeSubscription.id;
          nextBillingDate = activeSubscription.nextDueDate;
          features = getFeaturesForPlan(planType);
        }
      } catch (error) {
        console.error('Erro ao verificar assinatura:', error);
        features = getFeaturesForPlan('FREE');
      }
    }

    return res.status(200).json({
      success: true,
      planType,
      isActive,
      subscriptionId,
      nextBillingDate,
      features
    });
  } catch (error) {
    console.error('Erro ao obter plano atual:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao obter plano atual'
    });
  }
});

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

// Função para obter todas as features disponíveis para um plano
function getFeaturesForPlan(planType) {
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
  
  return featuresByPlan[planType] || [];
}

// Função para obter todas as features disponíveis
function getAllFeatures() {
  return [
    'basic_stats', 'view_home_content',
    'view_roulette_cards', 'view_roulette_sidepanel',
    'basic_notifications', 'advanced_stats',
    'trend_detection', 'prediction_tools',
    'api_access', 'vip_support',
    'custom_alerts', 'data_export'
  ];
}

module.exports = router; 