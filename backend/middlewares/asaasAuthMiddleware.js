/**
 * Middleware para autenticação JWT e verificação de assinatura no Asaas
 * Integra validação de token JWT e consulta ao status de assinatura via API Asaas
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../config/config');

// Configuração do Asaas API
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

/**
 * Middleware para validar token JWT e verificar assinatura no Asaas
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.required - Se a autenticação é obrigatória
 * @param {Array} options.allowedPlans - Lista de planos permitidos ('BASIC', 'PRO', 'PREMIUM')
 * @param {boolean} options.degradedPreview - Se true, permite acesso degradado para não assinantes
 * @returns {Function} Middleware Express
 */
exports.verifyTokenAndSubscription = (options = { 
  required: true,
  allowedPlans: ['BASIC', 'PRO', 'PREMIUM'],
  degradedPreview: false
}) => {
  return async (req, res, next) => {
    try {
      // Verificar se o token está presente no cabeçalho
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (options.required) {
          return res.status(401).json({
            success: false,
            message: 'Autenticação necessária para acessar este recurso',
            error: 'TOKEN_MISSING',
            subscriptionRequired: true
          });
        } else {
          // Token não é obrigatório, marcar acesso como degradado se permitido
          if (options.degradedPreview) {
            req.degradedAccess = true;
            return next();
          }
          // Continuar sem autenticação para recursos públicos
          return next();
        }
      }

      // Extrair o token
      const token = authHeader.split(' ')[1];

      try {
        // Verificar e decodificar o token
        const decoded = jwt.verify(token, config.jwt.secret);

        // Verificar se o payload tem as informações necessárias
        if (!decoded.id) {
          return res.status(401).json({
            success: false,
            message: 'Token inválido ou mal formado',
            error: 'INVALID_TOKEN_PAYLOAD'
          });
        }

        // Adicionar informações do usuário à requisição
        req.usuario = decoded;

        // Se não precisamos verificar assinatura, retornar aqui
        if (!options.allowedPlans || options.allowedPlans.length === 0) {
          return next();
        }

        // Verificar se o usuário tem um asaasCustomerId
        if (!decoded.asaasCustomerId) {
          if (options.degradedPreview) {
            req.degradedAccess = true;
            return next();
          }

          return res.status(403).json({
            success: false,
            message: 'Usuário não possui assinatura configurada',
            error: 'NO_ASAAS_CUSTOMER',
            subscriptionRequired: true
          });
        }

        // Consultar API do Asaas para verificar assinatura
        const asaasResponse = await axios.get(
          `${ASAAS_API_URL}/subscriptions?customer=${decoded.asaasCustomerId}`, 
          {
            headers: {
              'access_token': ASAAS_API_KEY
            }
          }
        );

        // Verificar se a consulta retornou assinaturas
        if (!asaasResponse.data || !asaasResponse.data.data || asaasResponse.data.data.length === 0) {
          if (options.degradedPreview) {
            req.degradedAccess = true;
            return next();
          }

          return res.status(403).json({
            success: false,
            message: 'Assinatura não encontrada',
            error: 'NO_SUBSCRIPTION_FOUND',
            subscriptionRequired: true
          });
        }

        // Verificar se há alguma assinatura válida (ACTIVE)
        const activeSubscription = asaasResponse.data.data.find(sub => 
          sub.status === 'ACTIVE' || 
          sub.status === 'active'
        );

        if (!activeSubscription) {
          // Verificar se há assinatura pendente ou em processamento
          const pendingSubscription = asaasResponse.data.data.find(sub => 
            sub.status === 'PENDING' || 
            sub.status === 'pending' ||
            sub.status === 'RECEIVED' || 
            sub.status === 'CONFIRMED'
          );

          if (pendingSubscription) {
            return res.status(403).json({
              success: false,
              message: 'Sua assinatura está pendente de confirmação de pagamento',
              error: 'PENDING_SUBSCRIPTION',
              subscriptionStatus: 'pending'
            });
          }

          if (options.degradedPreview) {
            req.degradedAccess = true;
            return next();
          }

          return res.status(403).json({
            success: false,
            message: 'Nenhuma assinatura válida encontrada',
            error: 'NO_VALID_SUBSCRIPTION',
            subscriptionRequired: true
          });
        }

        // Mapear o plano da assinatura para o formato interno
        const planMap = {
          'mensal': 'BASIC',
          'trimestral': 'PRO',
          'anual': 'PREMIUM',
          'basic': 'BASIC',
          'pro': 'PRO',
          'premium': 'PREMIUM'
        };

        // Verificar tipo de plano da assinatura
        let userPlan = 'BASIC'; // Default

        // Tentar extrair o plano do billingType primeiro
        if (activeSubscription.billingType && planMap[activeSubscription.billingType.toLowerCase()]) {
          userPlan = planMap[activeSubscription.billingType.toLowerCase()];
        } 
        // Depois verificar se há um valor explícito no campo de descrição
        else if (activeSubscription.description) {
          const lowerDesc = activeSubscription.description.toLowerCase();
          if (lowerDesc.includes('premium')) userPlan = 'PREMIUM';
          else if (lowerDesc.includes('pro')) userPlan = 'PRO';
          else if (lowerDesc.includes('basic')) userPlan = 'BASIC';
        }
        
        // Verificar se o plano está entre os permitidos
        if (options.allowedPlans.length > 0 && !options.allowedPlans.includes(userPlan)) {
          if (options.degradedPreview) {
            req.degradedAccess = true;
            return next();
          }

          return res.status(403).json({
            success: false,
            message: `Acesso negado. Este recurso requer um plano superior`,
            error: 'PLAN_UPGRADE_REQUIRED',
            currentPlan: userPlan,
            requiredPlans: options.allowedPlans,
            subscriptionRequired: true
          });
        }

        // Adicionar informações da assinatura à requisição
        req.subscription = {
          ...activeSubscription,
          plan: userPlan
        };

        // Continuar com o middleware seguinte
        next();
      } catch (jwtError) {
        // Erro na verificação do JWT
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Token expirado, faça login novamente',
            error: 'TOKEN_EXPIRED'
          });
        }

        return res.status(401).json({
          success: false,
          message: 'Token inválido',
          error: 'INVALID_TOKEN'
        });
      }
    } catch (error) {
      console.error('Erro na verificação de token e assinatura:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Erro interno durante verificação de credenciais',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  };
};

/**
 * Middleware para verificar se a assinatura permite acesso a determinado recurso
 * @param {String} resourceType - Tipo de recurso que requer verificação
 * @returns {Function} Middleware Express
 */
exports.requireResourceAccess = (resourceType) => {
  return async (req, res, next) => {
    try {
      // Verificar se o usuário e a assinatura estão presentes
      if (!req.usuario || !req.subscription) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado ou assinatura não verificada',
          error: 'AUTH_REQUIRED',
          subscriptionRequired: true
        });
      }

      // Mapeamento de recursos por plano
      const resourceAccessMap = {
        'BASIC': ['basic_data', 'standard_stats', 'limited_roulettes', 'roulette_data'],
        'PRO': ['basic_data', 'standard_stats', 'limited_roulettes', 'advanced_stats', 'unlimited_roulettes', 'real_time_updates', 'roulette_data'],
        'PREMIUM': ['basic_data', 'standard_stats', 'limited_roulettes', 'advanced_stats', 'unlimited_roulettes', 'real_time_updates', 'historical_data', 'ai_predictions', 'api_access', 'roulette_data']
      };

      // Verificar se o plano do usuário permite acesso ao recurso
      const planResources = resourceAccessMap[req.subscription.plan] || [];
      
      if (!planResources.includes(resourceType)) {
        return res.status(403).json({
          success: false,
          message: `Acesso negado. Este recurso requer um plano superior`,
          error: 'RESOURCE_NOT_ALLOWED',
          currentPlan: req.subscription.plan,
          requestedResource: resourceType,
          subscriptionRequired: true
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