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
        message: 'Acesso negado. Autenticação necessária'
      });
    }
    
    try {
      // Obter detalhes de assinatura do usuário
      const subscription = req.user.subscription || {};
      
      // Normalizar tipos de planos permitidos para comparação case-insensitive
      const normalizedAllowedTypes = options.allowedTypes.map(type => 
        typeof type === 'string' ? type.toLowerCase() : type
      );
      
      // Adicionar informação de diagnóstico
      console.log(`[subscriptionMiddleware] Verificando assinatura: status=${subscription.status}, type=${subscription.type}, allowedTypes=${JSON.stringify(normalizedAllowedTypes)}`);
      
      // Verificar se o usuário tem uma assinatura ativa
      // Garantir que pagamentos pendentes não contem como ativos
      const hasActiveSubscription = subscription.status && 
        ['active', 'ativo'].includes(subscription.status.toLowerCase()) && 
        !['pending', 'pendente'].includes(subscription.status.toLowerCase());
      
      // Adicionar informação de diagnóstico 
      console.log(`[subscriptionMiddleware] Verificando assinatura: status=${subscription.status}, type=${subscription.type}, active=${hasActiveSubscription}`);
      
      // Verificar se o tipo de assinatura é permitido (usando comparação case-insensitive)
      const subscriptionType = subscription.type ? subscription.type.toLowerCase() : '';
      const hasAllowedType = normalizedAllowedTypes.includes(subscriptionType);
      
      console.log(`[subscriptionMiddleware] Tipo de assinatura: ${subscriptionType}, permitido: ${hasAllowedType}, tipos permitidos: ${normalizedAllowedTypes.join(', ')}`);
      
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
          subscriptionRequired: true,
          requiredTypes: options.allowedTypes,
          currentType: subscription.type || 'none'
        });
      }
      
      // Se chegou aqui, o usuário tem permissão adequada
      next();
      
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno no servidor durante verificação de assinatura'
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