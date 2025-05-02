/**
 * Middleware aprimorado para verificação de assinatura do Asaas
 * Implementa cache para melhorar performance e reduzir requisições à API
 */

const getDb = require('../services/database');
const { checkSubscriptionStatus } = require('../services/asaasService');

// Cache em memória para reduzir número de consultas à API do Asaas
// Estrutura: { userId: { data: {...}, timestamp: 1234567890 } }
const subscriptionCache = {};
const CACHE_TTL = 600000; // 10 minutos em milissegundos

/**
 * Middleware para verificar se o usuário tem assinatura ativa no Asaas
 * Utiliza cache para reduzir requisições à API
 * @param {Object} options - Opções de configuração
 * @param {Boolean} options.required - Se assinatura é obrigatória
 * @param {Array} options.allowedPlans - Lista de planos permitidos
 * @returns {Function} Middleware do Express
 */
const verifyAsaasSubscription = (options = {}) => {
  return async (req, res, next) => {
    try {
      // Opções padrão
      const required = options.required !== false; // true por padrão
      const allowedPlans = options.allowedPlans || ['BASIC', 'PRO', 'PREMIUM'];
      
      // Verificar se o usuário está autenticado
      if (!req.user || !req.user.id) {
        if (required) {
          return res.status(401).json({
            success: false,
            message: 'Autenticação necessária para acessar este recurso',
            code: 'AUTH_REQUIRED'
          });
        } else {
          // Se autenticação não for obrigatória, apenas continua
          return next();
        }
      }
      
      const userId = req.user.id;
      
      // Primeira tentativa: verificar o banco de dados local
      const db = await getDb();
      
      // Verificar se há entrada em cache válida
      const cacheEntry = subscriptionCache[userId];
      const now = Date.now();
      
      if (cacheEntry && (now - cacheEntry.timestamp < CACHE_TTL)) {
        console.log(`[AsaasSubscription] Usando cache para usuário ${userId}`);
        
        // Se há cache válido e status é ACTIVE, seguir
        if (cacheEntry.data.status === 'ACTIVE') {
          req.subscription = cacheEntry.data;
          req.userPlan = {
            type: cacheEntry.data.plan_type,
            validUntil: cacheEntry.data.valid_until
          };
          return next();
        } else if (required) {
          // Se assinatura é obrigatória e não está ativa, bloquear
          return res.status(403).json({
            success: false,
            message: 'Este recurso requer uma assinatura ativa',
            code: 'SUBSCRIPTION_REQUIRED'
          });
        } else {
          // Se não é obrigatória, continuar sem adicionar dados de assinatura
          return next();
        }
      }
      
      // Buscar no banco de dados local
      const userSubscription = await db.collection('user_subscriptions').findOne({
        user_id: userId,
        status: 'ACTIVE',
        valid_until: { $gt: new Date() }
      });
      
      // Se encontrou assinatura ativa no banco local
      if (userSubscription) {
        console.log(`[AsaasSubscription] Assinatura encontrada no banco para usuário ${userId}`);
        
        // Verificar se o plano do usuário está na lista permitida
        if (allowedPlans.length > 0 && !allowedPlans.includes(userSubscription.plan_type)) {
          if (required) {
            return res.status(403).json({
              success: false,
              message: 'Seu plano atual não permite acesso a este recurso',
              currentPlan: userSubscription.plan_type,
              requiredPlans: allowedPlans.join(', '),
              code: 'PLAN_UPGRADE_REQUIRED'
            });
          } else {
            // Se não é obrigatória, continuar sem adicionar dados de assinatura
            return next();
          }
        }
        
        // Adicionar ao cache
        subscriptionCache[userId] = {
          data: userSubscription,
          timestamp: now
        };
        
        // Adicionar à requisição
        req.subscription = userSubscription;
        req.userPlan = {
          type: userSubscription.plan_type,
          validUntil: userSubscription.valid_until
        };
        
        return next();
      }
      
      // Se não encontrou no banco local, verificar diretamente no Asaas
      // Verificar se o usuário tem customerId do Asaas
      const user = await db.collection('users').findOne({ _id: userId });
      
      if (!user || !user.asaas_customer_id) {
        if (required) {
          return res.status(403).json({
            success: false,
            message: 'Usuário não possui conta no gateway de pagamento',
            code: 'NO_PAYMENT_ACCOUNT'
          });
        } else {
          return next();
        }
      }
      
      // Verificar diretamente no Asaas usando o serviço
      console.log(`[AsaasSubscription] Verificando assinatura no Asaas para usuário ${userId}`);
      const asaasResult = await checkSubscriptionStatus(user.asaas_customer_id);
      
      // Se não há assinatura ativa no Asaas
      if (!asaasResult.hasActiveSubscription) {
        if (required) {
          return res.status(403).json({
            success: false,
            message: 'Este recurso requer uma assinatura ativa',
            code: 'SUBSCRIPTION_REQUIRED'
          });
        } else {
          return next();
        }
      }
      
      // Determinar o tipo de plano com base na assinatura do Asaas
      const subscription = asaasResult.subscription;
      let planType = 'BASIC'; // Padrão
      
      if (subscription.description && subscription.description.includes('PRO')) {
        planType = 'PRO';
      } else if (subscription.description && subscription.description.includes('PREMIUM')) {
        planType = 'PREMIUM';
      } else if (subscription.value >= 99.90) {
        planType = 'PREMIUM';
      } else if (subscription.value >= 49.90) {
        planType = 'PRO';
      }
      
      // Verificar se o plano do usuário está na lista permitida
      if (allowedPlans.length > 0 && !allowedPlans.includes(planType)) {
        if (required) {
          return res.status(403).json({
            success: false,
            message: 'Seu plano atual não permite acesso a este recurso',
            currentPlan: planType,
            requiredPlans: allowedPlans.join(', '),
            code: 'PLAN_UPGRADE_REQUIRED'
          });
        } else {
          return next();
        }
      }
      
      // Calcular data de validade
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1); // Assumir 1 mês de validade
      
      // Criar objeto de assinatura
      const newSubscription = {
        user_id: userId,
        asaas_subscription_id: subscription.id,
        asaas_customer_id: user.asaas_customer_id,
        status: 'ACTIVE',
        plan_type: planType,
        valid_until: validUntil,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Salvar no banco de dados
      await db.collection('user_subscriptions').updateOne(
        { user_id: userId },
        { $set: newSubscription },
        { upsert: true }
      );
      
      // Adicionar ao cache
      subscriptionCache[userId] = {
        data: newSubscription,
        timestamp: now
      };
      
      // Adicionar à requisição
      req.subscription = newSubscription;
      req.userPlan = {
        type: planType,
        validUntil: validUntil
      };
      
      console.log(`[AsaasSubscription] Assinatura verificada e atualizada para usuário ${userId}`);
      return next();
      
    } catch (error) {
      console.error('[AsaasSubscription] Erro ao verificar assinatura:', error);
      
      // Em caso de erro, permitir acesso se a assinatura não for obrigatória
      if (!options.required) {
        return next();
      }
      
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar assinatura',
        code: 'SUBSCRIPTION_CHECK_ERROR'
      });
    }
  };
};

/**
 * Limpa a entrada de cache para um usuário específico
 * Útil após atualizações de assinatura via webhook
 * @param {string} userId - ID do usuário
 */
const clearSubscriptionCache = (userId) => {
  if (subscriptionCache[userId]) {
    delete subscriptionCache[userId];
    console.log(`[AsaasSubscription] Cache limpo para usuário ${userId}`);
  }
};

/**
 * Verifica se o usuário tem acesso a um recurso específico
 * @param {string} resourceType - Tipo de recurso a verificar
 * @returns {Function} Middleware do Express
 */
const requireResourceAccess = (resourceType) => {
  return async (req, res, next) => {
    try {
      // Se não há dados de assinatura na requisição, bloquear
      if (!req.subscription || !req.userPlan) {
        return res.status(403).json({
          success: false,
          message: 'Este recurso requer uma assinatura ativa',
          code: 'SUBSCRIPTION_REQUIRED'
        });
      }
      
      // Determinar recursos disponíveis com base no tipo de plano
      const planType = req.userPlan.type;
      let allowedResources = [];
      
      switch (planType) {
        case 'PREMIUM':
          allowedResources = [
            'historical_data', 'advanced_stats', 'real_time', 'all_roulettes',
            'standard_stats', 'basic_stats'
          ];
          break;
        case 'PRO':
          allowedResources = [
            'standard_stats', 'real_time', 'all_roulettes', 'basic_stats'
          ];
          break;
        case 'BASIC':
          allowedResources = ['basic_stats', 'standard_stats'];
          break;
        default:
          allowedResources = [];
      }
      
      // Verificar se o recurso está na lista permitida
      if (!allowedResources.includes(resourceType)) {
        return res.status(403).json({
          success: false,
          message: 'Seu plano não permite acesso a este recurso',
          currentPlan: planType,
          requiredResource: resourceType,
          code: 'RESOURCE_ACCESS_DENIED'
        });
      }
      
      next();
    } catch (error) {
      console.error('[AsaasSubscription] Erro ao verificar acesso a recurso:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar permissões',
        code: 'ACCESS_CHECK_ERROR'
      });
    }
  };
};

module.exports = {
  verifyAsaasSubscription,
  clearSubscriptionCache,
  requireResourceAccess
}; 