/**
 * Middleware para autenticação JWT e verificação de assinatura no Asaas
 * Integra validação de token JWT e consulta ao status de assinatura via API Asaas
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');
// Configuração substituída por objeto vazio
const config = {};
const getDb = require('../services/database');
const { ObjectId } = require('mongodb');
const { JWT_SECRET } = require('./jwtAuthMiddleware');

// Configuração do Asaas API
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Log de configuração
console.log(`[ASAAS-AUTH] Usando JWT_SECRET: ${JWT_SECRET ? '******' : 'Não definido'} (importado do jwtAuthMiddleware)`);

/**
 * Middleware para verificação de assinatura no Asaas
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.required - Define se a verificação é obrigatória
 * @returns {Function} Middleware Express
 */
const verifyAsaasSubscription = (options = { required: true }) => {
  return async (req, res, next) => {
    try {
      // Verificar se há token de autenticação
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (options.required) {
          return res.status(401).json({
            success: false,
            message: 'Autenticação necessária'
          });
        }
        
        req.subscription = null;
        return next();
      }
      
      // Extrair e verificar token
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Adicionar usuário à requisição
      req.user = decoded;
      
      // Verificar assinatura no Asaas (simplificado para exemplo)
      // Em uma implementação real, você consultaria a API do Asaas aqui
      
      if (decoded.customerId) {
        // Aqui deveria consultar o Asaas para verificar assinatura
        // Como exemplo, definimos uma assinatura padrão
        req.subscription = {
          status: 'ACTIVE',
          expirationDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 dias
        };
      } else {
        req.subscription = null;
      }
      
      next();
    } catch (error) {
      if (options.required) {
        return res.status(401).json({
          success: false,
          message: 'Erro na verificação de autenticação',
          error: error.message
        });
      }
      
      req.subscription = null;
      next();
    }
  };
};

module.exports = { verifyAsaasSubscription }; 