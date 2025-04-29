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

// Status de assinatura válidos
const VALID_SUBSCRIPTION_STATUSES = ['ACTIVE', 'active'];
// Status de assinatura inválidos que devem ser explicitamente rejeitados
const INVALID_SUBSCRIPTION_STATUSES = ['PENDING', 'pending', 'INACTIVE', 'inactive', 'CANCELLED', 'cancelled'];

/**
 * Middleware para validar token JWT e verificar assinatura no Asaas
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.required - Se a autenticação é obrigatória
 * @param {Array} options.allowedPlans - Lista de planos permitidos ('BASIC', 'PRO', 'PREMIUM')
 * @returns {Function} Middleware Express
 */
exports.verifyTokenAndSubscription = (options = { 
  required: true,
  allowedPlans: ['BASIC', 'PRO', 'PREMIUM']
}) => {
  return async (req, res, next) => {
    try {
      // Verificar se o token está presente no cabeçalho
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (options.required) {
          console.log(`[Auth] Requisição sem token de autenticação: ${req.originalUrl}`);
          return res.status(401).json({
            success: false,
            message: 'Autenticação necessária para acessar este recurso',
            error: 'TOKEN_MISSING'
          });
        } else {
          // Token não é obrigatório, continuar sem autenticação
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
          console.warn(`[Auth] Token inválido ou mal formado: ${req.originalUrl}`);
          return res.status(401).json({
            success: false,
            message: 'Token inválido ou mal formado',
            error: 'INVALID_TOKEN_PAYLOAD'
          });
        }

        // Adicionar informações do usuário à requisição
        req.usuario = decoded;
        console.log(`[Auth] Usuário autenticado: ${decoded.id} (${decoded.email})`);

        // Se não precisamos verificar assinatura, retornar aqui
        if (!options.allowedPlans || options.allowedPlans.length === 0) {
          return next();
        }

        // Verificar se o usuário tem um asaasCustomerId
        if (!decoded.asaasCustomerId) {
          console.warn(`[Auth] Usuário ${decoded.id} não possui asaasCustomerId configurado`);
          return res.status(403).json({
            success: false,
            message: 'Usuário não possui assinatura configurada',
            error: 'NO_ASAAS_CUSTOMER'
          });
        }

        // Consultar API do Asaas para verificar assinatura
        console.log(`[Auth] Verificando assinatura para usuário ${decoded.id} (asaasCustomerId: ${decoded.asaasCustomerId})`);
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
          console.warn(`[Auth] Nenhuma assinatura encontrada para o usuário ${decoded.id}`);
          return res.status(403).json({
            success: false,
            message: 'Assinatura não encontrada',
            error: 'NO_SUBSCRIPTION_FOUND'
          });
        }

        // Verificar se há alguma assinatura ativa
        const activeSubscription = asaasResponse.data.data.find(sub => 
          VALID_SUBSCRIPTION_STATUSES.includes(sub.status)
        );

        if (!activeSubscription) {
          // Verificar se há assinaturas em estado PENDING
          const pendingSubscription = asaasResponse.data.data.find(sub => 
            INVALID_SUBSCRIPTION_STATUSES.includes(sub.status)
          );
          
          if (pendingSubscription) {
            console.warn(`[Auth] Usuário ${decoded.id} possui assinatura em estado ${pendingSubscription.status}, acesso negado`);
            return res.status(403).json({
              success: false,
              message: `Assinatura encontrada com status "${pendingSubscription.status}". Aguarde a confirmação.`,
              error: 'SUBSCRIPTION_PENDING',
              subscriptionStatus: pendingSubscription.status
            });
          }
          
          console.warn(`[Auth] Nenhuma assinatura ativa encontrada para o usuário ${decoded.id}`);
          return res.status(403).json({
            success: false,
            message: 'Nenhuma assinatura ativa encontrada',
            error: 'NO_ACTIVE_SUBSCRIPTION'
          });
        }

        // Verificar se há pagamento confirmado
        console.log(`[Auth] Verificando pagamentos da assinatura ${activeSubscription.id}`);
        const paymentsResponse = await axios.get(
          `${ASAAS_API_URL}/subscriptions/${activeSubscription.id}/payments`,
          {
            headers: {
              'access_token': ASAAS_API_KEY
            }
          }
        );
        
        // Validar pagamentos
        const payments = paymentsResponse.data?.data || [];
        const hasConfirmedPayment = payments.some(payment => 
          payment.status === 'CONFIRMED' || payment.status === 'RECEIVED'
        );
        
        if (!hasConfirmedPayment && payments.length > 0) {
          console.warn(`[Auth] Usuário ${decoded.id} possui assinatura ativa mas sem pagamento confirmado`);
          return res.status(403).json({
            success: false,
            message: 'Assinatura ativa encontrada, mas aguardando confirmação de pagamento',
            error: 'PAYMENT_NOT_CONFIRMED',
            paymentStatus: payments[0]?.status
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
        const billingType = activeSubscription.billingType?.toLowerCase() || '';
        const planId = activeSubscription.planId || '';
        
        // Tentar determinar o plano com base em diferentes propriedades
        let userPlan = planMap[billingType] || planMap[planId] || 'BASIC';
        
        // Verificar se o plano está entre os permitidos
        if (!options.allowedPlans.includes(userPlan)) {
          console.warn(`[Auth] Usuário ${decoded.id} possui plano ${userPlan} mas precisa de um dos seguintes: ${options.allowedPlans.join(', ')}`);
          return res.status(403).json({
            success: false,
            message: `Acesso negado. Este recurso requer um plano superior`,
            error: 'PLAN_UPGRADE_REQUIRED',
            currentPlan: userPlan,
            requiredPlans: options.allowedPlans
          });
        }

        // Adicionar informações da assinatura à requisição
        req.subscription = {
          ...activeSubscription,
          plan: userPlan,
          hasConfirmedPayment
        };

        console.log(`[Auth] Usuário ${decoded.id} autenticado com sucesso e possui assinatura ativa (plano: ${userPlan})`);
        
        // Continuar com o middleware seguinte
        next();
      } catch (jwtError) {
        // Erro na verificação do JWT
        if (jwtError.name === 'TokenExpiredError') {
          console.warn(`[Auth] Token expirado: ${req.originalUrl}`);
          return res.status(401).json({
            success: false,
            message: 'Token expirado, faça login novamente',
            error: 'TOKEN_EXPIRED'
          });
        }

        console.warn(`[Auth] Token inválido: ${jwtError.message}`);
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
          error: 'AUTH_REQUIRED'
        });
      }

      // Mapeamento de recursos por plano
      const resourceAccessMap = {
        'BASIC': ['basic_data', 'standard_stats', 'limited_roulettes'],
        'PRO': ['basic_data', 'standard_stats', 'limited_roulettes', 'advanced_stats', 'unlimited_roulettes', 'real_time_updates'],
        'PREMIUM': ['basic_data', 'standard_stats', 'limited_roulettes', 'advanced_stats', 'unlimited_roulettes', 'real_time_updates', 'historical_data', 'ai_predictions', 'api_access']
      };

      // Verificar se o plano do usuário permite acesso ao recurso
      const planResources = resourceAccessMap[req.subscription.plan] || [];
      
      if (!planResources.includes(resourceType)) {
        console.warn(`[Auth] Usuário ${req.usuario.id} com plano ${req.subscription.plan} tentou acessar recurso restrito: ${resourceType}`);
        return res.status(403).json({
          success: false,
          message: `Acesso negado. Este recurso requer um plano superior`,
          error: 'RESOURCE_NOT_ALLOWED',
          currentPlan: req.subscription.plan,
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