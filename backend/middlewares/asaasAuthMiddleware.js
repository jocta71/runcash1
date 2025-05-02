/**
 * Middleware para autenticação JWT e verificação de assinatura no Asaas
 * Integra validação de token JWT e consulta ao status de assinatura via API Asaas
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../config/config');
const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

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
          console.log('Acesso negado - token não fornecido');
          return res.status(401).json({
            success: false,
            message: 'Autenticação necessária para acessar este recurso',
            code: 'AUTH_REQUIRED'
          });
        } else {
          // Token não é obrigatório, continuar sem autenticação
          req.userPlan = { type: 'FREE' };
          req.subscription = null;
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
          console.log('Token inválido - acesso negado');
          return res.status(401).json({
            success: false,
            message: 'Token inválido ou mal formado',
            code: 'INVALID_TOKEN'
          });
        }

        // Adicionar informações do usuário à requisição
        req.usuario = decoded;
        
        // Buscar assinatura do usuário no banco de dados
        const db = await getDb();
        const userSubscription = await db.collection('subscriptions').findOne({
          user_id: decoded.id,
          status: { $in: ['active', 'ACTIVE', 'ativa'] }
        });
        
        // Se não encontrar assinatura no formato das collections, tentar o modelo mongoose
        if (!userSubscription) {
          // Verificar em modelos mongoose se não encontrou na collection
          const assinatura = await db.collection('assinaturas').findOne({
            usuario: ObjectId.isValid(decoded.id) ? new ObjectId(decoded.id) : decoded.id,
            status: 'ativa',
            validade: { $gt: new Date() }
          });

          // Se não encontrou assinatura e é obrigatória
          if (!assinatura && options.required) {
            return res.status(403).json({
              success: false,
              message: 'Você precisa de uma assinatura ativa para acessar este recurso',
              code: 'SUBSCRIPTION_REQUIRED'
            });
          }

          // Se encontrou assinatura, verificar o plano
          if (assinatura && options.allowedPlans && options.allowedPlans.length > 0) {
            // Mapear plano do modelo mongoose para o formato esperado
            const planoMap = {
              'mensal': 'BASIC',
              'trimestral': 'PRO',
              'anual': 'PREMIUM'
            };
            
            const userPlanType = planoMap[assinatura.plano] || 'BASIC';
            
            if (!options.allowedPlans.includes(userPlanType)) {
              return res.status(403).json({
                success: false,
                message: `É necessário um plano superior para acessar este recurso. Planos permitidos: ${options.allowedPlans.join(', ')}`,
                code: 'PLAN_UPGRADE_REQUIRED'
              });
            }
            
            // Definir plano do usuário
            req.userPlan = { type: userPlanType };
            req.subscription = assinatura;
          } else if (!options.required) {
            // Assinatura não encontrada, mas não é obrigatória
            req.userPlan = { type: 'FREE' };
            req.subscription = null;
          }
          
          return next();
        }
        
        // Verificar se o plano do usuário está entre os permitidos
        if (options.allowedPlans && options.allowedPlans.length > 0) {
          const userPlanType = userSubscription.plan_id || 'BASIC';
          
          if (!options.allowedPlans.includes(userPlanType)) {
            return res.status(403).json({
              success: false,
              message: `É necessário um plano superior para acessar este recurso. Planos permitidos: ${options.allowedPlans.join(', ')}`,
              code: 'PLAN_UPGRADE_REQUIRED'
            });
          }
        }
        
        // Definir plano do usuário
        req.userPlan = { type: userSubscription.plan_id || 'BASIC' };
        req.subscription = userSubscription;
        
        // Continuar com o middleware seguinte
        return next();
        
      } catch (jwtError) {
        // Erro na verificação do JWT
        console.log('Erro JWT - acesso negado:', jwtError.message);
        return res.status(401).json({
          success: false,
          message: 'Token inválido ou expirado',
          error: jwtError.message,
          code: 'INVALID_TOKEN'
        });
      }
    } catch (error) {
      console.error('Erro na verificação de token e assinatura:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao verificar autenticação',
        error: error.message,
        code: 'INTERNAL_ERROR'
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
    // Verificar se o usuário está autenticado e tem assinatura
    if (!req.usuario || !req.subscription) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação e assinatura necessárias para acessar este recurso',
        code: 'AUTH_SUBSCRIPTION_REQUIRED'
      });
    }
    
    // Verificar se o plano do usuário permite acesso ao recurso solicitado
    const db = await getDb();
    
    // Buscar recursos permitidos para o plano do usuário
    const planoUsuario = req.userPlan?.type || 'FREE';
    const plano = await db.collection('plans').findOne({ type: planoUsuario });
    
    if (!plano || !plano.allowedFeatures || !plano.allowedFeatures.includes(resourceType)) {
      return res.status(403).json({
        success: false,
        message: `Seu plano atual não permite acesso a este recurso. Faça upgrade para um plano superior.`,
        requiredResource: resourceType,
        code: 'RESOURCE_ACCESS_DENIED'
      });
    }
    
    return next();
  };
}; 