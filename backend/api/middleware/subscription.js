const Subscription = require('../models/Subscription');
const asyncHandler = require('express-async-handler');

/**
 * Middleware para verificar se o usuário tem uma assinatura ativa
 * @returns {Function} Middleware para Express
 */
const checkSubscription = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: 'Não autorizado, faça login para acessar este recurso'
    });
  }

  // Buscar assinatura ativa do usuário
  const subscription = await Subscription.findOne({ 
    userId: req.user.id,
    status: 'active'
  });

  // Se não encontrou assinatura ou se a assinatura expirou
  if (!subscription || !subscription.isActive()) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Você precisa de uma assinatura ativa para acessar este recurso.'
    });
  }

  // Guardar informações da assinatura para uso posterior
  req.subscription = subscription;
  next();
});

/**
 * Middleware para verificar acesso a recursos específicos baseado na assinatura
 * @param {String} featureId - ID do recurso que está sendo acessado
 * @returns {Function} Middleware para Express
 */
const requireFeatureAccess = (featureId) => asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: 'Não autorizado, faça login para acessar este recurso'
    });
  }

  // Se já temos a assinatura no request, usamos ela
  let subscription = req.subscription;
  
  // Se não, precisamos buscar
  if (!subscription) {
    subscription = await Subscription.findOne({ 
      userId: req.user.id,
      status: 'active'
    });
  }

  // Se não encontrou assinatura ou se a assinatura expirou
  if (!subscription || !subscription.isActive()) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Você precisa de uma assinatura ativa para acessar este recurso.'
    });
  }

  // Verificar se o plano do usuário permite acesso a este recurso
  if (!subscription.hasAccess(featureId)) {
    return res.status(403).json({
      success: false,
      message: `Acesso negado. Seu plano atual não inclui acesso a este recurso. Faça upgrade para acessar '${featureId}'.`
    });
  }

  // Guardar informações da assinatura para uso posterior
  req.subscription = subscription;
  next();
});

/**
 * Middleware para verificar acesso a roulettes específicas com base no plano
 * @returns {Function} Middleware para Express
 */
const limitRouletteAccess = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: 'Não autorizado, faça login para acessar este recurso'
    });
  }

  // Se já temos a assinatura no request, usamos ela
  let subscription = req.subscription;
  
  // Se não, precisamos buscar
  if (!subscription) {
    subscription = await Subscription.findOne({ 
      userId: req.user.id,
      status: 'active'
    });
  }

  // Se não encontrou assinatura ou se a assinatura expirou, limitar ao plano gratuito
  if (!subscription || !subscription.isActive()) {
    req.userPlan = 'free';
  } else {
    req.userPlan = subscription.planId;
  }

  // Definir restrições com base no plano
  const planRestrictions = {
    'free': {
      maxRoulettes: 2,
      historyLimit: 50,
      allowedRoulettes: ['777', 'brazilBet'] // IDs das roletas permitidas no plano gratuito
    },
    'basic': {
      maxRoulettes: 5,
      historyLimit: 200,
      allowedRoulettes: null // Null significa que todas são permitidas até o limite maxRoulettes
    },
    'pro': {
      maxRoulettes: 10,
      historyLimit: 500,
      allowedRoulettes: null
    },
    'premium': {
      maxRoulettes: null, // Null significa ilimitado
      historyLimit: null, // Null significa ilimitado
      allowedRoulettes: null
    }
  };

  // Adicionar restrições ao objeto de requisição
  req.planRestrictions = planRestrictions[req.userPlan] || planRestrictions.free;
  
  next();
});

module.exports = {
  checkSubscription,
  requireFeatureAccess,
  limitRouletteAccess
}; 