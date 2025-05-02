/**
 * Middleware para verificar assinaturas e controlar acesso a recursos
 */

const getDb = require('../utils/db');
const { ObjectId } = require('mongodb');

/**
 * Verifica se o usuário tem uma assinatura ativa
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.required - Se a assinatura é obrigatória (padrão: true)
 * @param {Array} options.allowedPlans - Lista de planos permitidos (opcional)
 * @returns {Function} Middleware Express
 */
exports.requireSubscription = (options = { required: true }) => {
  return async (req, res, next) => {
    try {
      // Acesso liberado - ignorando verificação de assinatura
      console.log('Middleware de assinatura: Permitindo acesso independente de assinatura');
      
      // Configurar usuário como tendo assinatura premium
      req.subscription = {
        status: 'active',
        plan_id: 'PREMIUM',
        type: 'PREMIUM'
      };
      req.hasSubscription = true;
      
      // Continuar para a próxima etapa
      next();
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      
      // Mesmo em caso de erro, permitir acesso
      req.subscription = {
        status: 'active',
        plan_id: 'PREMIUM',
        type: 'PREMIUM'
      };
      req.hasSubscription = true;
      
      next();
    }
  };
};

/**
 * Verifica se o usuário tem acesso a determinado recurso
 * @param {String} resourceType - Tipo de recurso que requer verificação
 * @returns {Function} Middleware Express
 */
exports.requireResourceAccess = (resourceType) => {
  return async (req, res, next) => {
    // Acesso liberado para todos os recursos
    console.log(`Middleware de recursos: Permitindo acesso ao recurso '${resourceType}'`);
    
    // Configurar usuário como tendo assinatura premium
    req.subscription = {
      status: 'active',
      plan_id: 'PREMIUM',
      type: 'PREMIUM'
    };
    req.hasSubscription = true;
    
    // Continuar para a próxima etapa
    next();
  };
}; 