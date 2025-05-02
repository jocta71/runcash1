/**
 * Middleware para verificação de assinatura
 * Controla acesso a recursos baseado no tipo de assinatura do usuário
 */

/**
 * Verifica se o usuário possui uma assinatura ativa
 * @param {Object} options - Opções de configuração
 * @param {Array} options.allowedTypes - Lista de tipos de assinatura permitidos ('basic', 'premium', etc)
 * @param {Boolean} options.requireActive - Se true, requer que a assinatura esteja ativa
 * @param {Boolean} options.degradedPreview - Se true, permite continuar sem assinatura mas marca o request para versão degradada
 */
exports.requireSubscription = (options = { 
  allowedTypes: ['basic', 'premium'], 
  requireActive: true,
  degradedPreview: false
}) => {
  return async (req, res, next) => {
    // Se não há usuário autenticado, verifica se degradedPreview está ativo
    if (!req.user) {
      if (options.degradedPreview) {
        req.degradedAccess = true;
        return next();
      }
      
      return res.status(401).json({
        success: false,
        message: 'Acesso negado. Autenticação necessária',
        error: 'NOT_AUTHENTICATED'
      });
    }
    
    try {
      // Obter detalhes de assinatura do usuário
      const subscription = req.user.subscription || {};
      
      // Normalizar tipos de planos permitidos para comparação case-insensitive
      const normalizedAllowedTypes = (options.allowedTypes || []).map(type => 
        typeof type === 'string' ? type.toLowerCase() : String(type).toLowerCase()
      );
      
      // Adicionar informação de diagnóstico
      console.log(`[subscriptionMiddleware] Verificando assinatura: user=${req.user.username}, status=${subscription.status}, type=${subscription.type}, allowedTypes=${JSON.stringify(normalizedAllowedTypes)}`);
      
      // Verificar se o usuário tem uma assinatura ativa
      // Garantir que pagamentos pendentes não contem como ativos
      const statusLowerCase = (subscription.status || '').toLowerCase();
      const hasActiveSubscription = statusLowerCase && 
        ['active', 'ativo'].includes(statusLowerCase) && 
        !['pending', 'pendente', 'inactive', 'inativo', 'cancelled', 'cancelado'].includes(statusLowerCase);
      
      // Adicionar informação de diagnóstico 
      console.log(`[subscriptionMiddleware] Verificando assinatura: status=${subscription.status}, type=${subscription.type}, active=${hasActiveSubscription}`);
      
      // Verificar se o tipo de assinatura é permitido (usando comparação case-insensitive)
      // Extrair o tipo da assinatura com tratamento para diferentes formatos possíveis
      let subscriptionType = '';
      if (subscription) {
        if (subscription.type) {
          subscriptionType = subscription.type.toLowerCase();
        } else if (subscription.plan) {
          subscriptionType = subscription.plan.toLowerCase();
        } else if (subscription.planId) {
          subscriptionType = subscription.planId.toLowerCase(); 
        }
      }
      
      // Se não temos tipos permitidos definidos, qualquer tipo é válido
      const hasAllowedType = normalizedAllowedTypes.length === 0 || 
                             normalizedAllowedTypes.includes(subscriptionType);
      
      console.log(`[subscriptionMiddleware] Tipo de assinatura: ${subscriptionType}, permitido: ${hasAllowedType}, tipos permitidos: ${normalizedAllowedTypes.join(', ') || 'qualquer'}`);
      
      // Verificar se requer assinatura ativa
      if (options.requireActive && !hasActiveSubscription) {
        // Se permitir preview degradado, continua mas marca o request
        if (options.degradedPreview) {
          req.degradedAccess = true;
          return next();
        }
        
        return res.status(403).json({
          success: false,
          message: 'Acesso negado. Assinatura inativa ou expirada',
          error: 'NO_ACTIVE_SUBSCRIPTION',
          subscriptionRequired: true,
          status: subscription.status || 'none'
        });
      }
      
      // Verificar se o tipo de assinatura é permitido
      if (!hasAllowedType) {
        // Se permitir preview degradado, continua mas marca o request
        if (options.degradedPreview) {
          req.degradedAccess = true;
          return next();
        }
        
        return res.status(403).json({
          success: false,
          message: `Acesso negado. Necessário assinatura: ${options.allowedTypes.join(' ou ')}`,
          error: 'SUBSCRIPTION_TYPE_NOT_ALLOWED',
          subscriptionRequired: true,
          requiredTypes: options.allowedTypes,
          currentType: subscriptionType || 'none'
        });
      }
      
      // Se chegou aqui, o usuário tem permissão adequada
      next();
      
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno no servidor durante verificação de assinatura',
        error: 'SUBSCRIPTION_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware para permitir acesso apenas a usuários premium
 */
exports.requirePremium = (options = { degradedPreview: false }) => {
  return exports.requireSubscription({
    allowedTypes: ['premium'],
    requireActive: true,
    degradedPreview: options.degradedPreview
  });
};

/**
 * Middleware para permitir acesso a usuários com qualquer assinatura ativa
 */
exports.requireAnySubscription = (options = { degradedPreview: false }) => {
  return exports.requireSubscription({
    allowedTypes: ['basic', 'premium', 'pro'],
    requireActive: true,
    degradedPreview: options.degradedPreview
  });
};

/**
 * Middleware para marcar requisição como degradada
 * Usado quando se quer permitir acesso parcial a recursos premium
 */
exports.markRequestDegraded = (req, res, next) => {
  req.degradedAccess = true;
  next();
};

/**
 * Middleware utilitário para configurar headers de resposta
 * Adiciona informações sobre o acesso ao conteúdo premium
 */
exports.addContentAccessInfo = (req, res, next) => {
  // Função para executar ao final do middleware
  const originalSend = res.send;
  
  // Sobrescrever o método send para adicionar headers antes de enviar resposta
  res.send = function(body) {
    // Adicionar headers sobre acesso degradado
    if (req.degradedAccess) {
      res.set('X-Premium-Access', 'degraded');
      
      // Se o corpo é JSON, adicionar metadados sobre acesso
      if (typeof body === 'object') {
        body.premiumAccess = false;
        body.degradedView = true;
        
        // Adicionar tipo de plano atual se disponível
        if (req.user && req.user.subscription) {
          body.currentPlanType = req.user.subscription.type;
        }
      }
    } else if (req.user && req.user.subscription && 
               req.user.subscription.status === 'active') {
      res.set('X-Premium-Access', 'full');
      
      // Se o corpo é JSON, adicionar metadados sobre acesso
      if (typeof body === 'object') {
        body.premiumAccess = true;
        body.degradedView = false;
      }
    }
    
    // Chamar o método original
    originalSend.call(this, body);
  };
  
  next();
};

/**
 * Middleware para verificação de assinaturas Asaas
 * Verifica se o usuário tem um plano ativo antes de permitir acesso a recursos premium
 */

const getDb = require('../services/database');

/**
 * Middleware para verificar se o usuário possui uma assinatura ativa
 * Deve ser usado após o middleware de autenticação
 */
const checkActiveSubscription = async (req, res, next) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const userId = req.user.id;
    const db = await getDb();
    
    // Buscar assinatura ativa do usuário
    const subscription = await db.collection('userSubscriptions').findOne({
      userId,
      status: 'ACTIVE' // Apenas assinaturas ativas
    });
    
    if (!subscription) {
      // Usuário sem assinatura ativa
      return res.status(403).json({
        success: false,
        message: 'Este recurso requer uma assinatura ativa',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }
    
    // Adicionar informações da assinatura à requisição
    req.userPlan = {
      type: subscription.planType,
      isActive: true,
      nextDueDate: subscription.nextDueDate,
      asaasSubscriptionId: subscription.asaasSubscriptionId
    };
    
    // Prosseguir com a requisição
    next();
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status da assinatura',
      error: error.message
    });
  }
};

/**
 * Middleware que verifica se existe uma assinatura, mas permite
 * o acesso mesmo para usuários sem assinatura ativa.
 * Apenas adiciona informações do plano à requisição, se existir.
 */
const addSubscriptionInfo = async (req, res, next) => {
  try {
    // Se não houver usuário autenticado, apenas continua
    if (!req.user || !req.user.id) {
      return next();
    }
    
    const userId = req.user.id;
    const db = await getDb();
    
    // Buscar assinatura do usuário, mesmo que não seja ativa
    const subscription = await db.collection('userSubscriptions').findOne({ userId });
    
    if (subscription) {
      // Adicionar informações da assinatura à requisição
      req.userPlan = {
        type: subscription.planType,
        isActive: subscription.status === 'ACTIVE',
        status: subscription.status,
        nextDueDate: subscription.nextDueDate,
        asaasSubscriptionId: subscription.asaasSubscriptionId
      };
    } else {
      // Definir que não há plano
      req.userPlan = {
        isActive: false,
        type: 'FREE'
      };
    }
    
    // Prosseguir com a requisição
    next();
  } catch (error) {
    console.error('Erro ao adicionar informações de assinatura:', error);
    // Não bloquear o fluxo em caso de erro, apenas continuar
    next();
  }
};

module.exports = {
  checkActiveSubscription,
  addSubscriptionInfo
}; 