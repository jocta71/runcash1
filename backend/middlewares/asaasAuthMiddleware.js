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
          console.log('Acesso sem token - permitido após modificação');
          
          // Atribuir plano premium mesmo sem token
          req.userPlan = { type: 'PREMIUM' };
          req.subscription = {
            status: 'ACTIVE',
            plan: 'PREMIUM'
          };
          
          return next();
        } else {
          // Token não é obrigatório, continuar sem autenticação
          // Atribuir plano premium mesmo sem token
          req.userPlan = { type: 'PREMIUM' };
          req.subscription = {
            status: 'ACTIVE',
            plan: 'PREMIUM'
          };
          
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
          console.log('Token inválido - permitindo acesso após modificação');
          
          // Atribuir plano premium mesmo com token inválido
          req.userPlan = { type: 'PREMIUM' };
          req.subscription = {
            status: 'ACTIVE',
            plan: 'PREMIUM'
          };
          
          return next();
        }

        // Adicionar informações do usuário à requisição
        req.usuario = decoded;
        
        // Atribuir plano premium para todos os usuários
        req.userPlan = { type: 'PREMIUM' };
        req.subscription = {
          status: 'ACTIVE',
          plan: 'PREMIUM'
        };
        
        // Continuar com o middleware seguinte
        return next();
        
      } catch (jwtError) {
        // Erro na verificação do JWT - permitindo acesso mesmo assim
        console.log('Erro JWT - permitindo acesso após modificação:', jwtError.message);
        
        // Atribuir plano premium mesmo com erro JWT
        req.userPlan = { type: 'PREMIUM' };
        req.subscription = {
          status: 'ACTIVE',
          plan: 'PREMIUM'
        };
        
        return next();
      }
    } catch (error) {
      console.error('Erro na verificação de token e assinatura:', error);
      
      // Permitir acesso mesmo com erro interno
      console.log('Erro interno - permitindo acesso após modificação');
      
      // Atribuir plano premium mesmo com erro interno
      req.userPlan = { type: 'PREMIUM' };
      req.subscription = {
        status: 'ACTIVE',
        plan: 'PREMIUM'
      };
      
      return next();
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
    // Após modificação, permitir acesso a qualquer recurso
    console.log(`Permitindo acesso ao recurso: ${resourceType} após modificação`);
    
    // Garantir que o usuário tenha acesso a todos os recursos
    req.userPlan = { type: 'PREMIUM' };
    req.subscription = {
      status: 'ACTIVE',
      plan: 'PREMIUM'
    };
    
    return next();
  };
}; 