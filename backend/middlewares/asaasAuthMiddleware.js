/**
 * Middleware para autenticação Asaas - DESATIVADO
 * Substituído por versão sem processamento JWT para reduzir consumo de memória
 */

// Dependências mantidas apenas por compatibilidade
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
console.log(`[ASAAS-AUTH] Middleware desativado para reduzir consumo de memória`);

/**
 * Middleware para verificação de assinatura no Asaas - DESATIVADO
 * Agora passa todos os usuários automaticamente
 */
const verifyAsaasSubscription = (options = { required: true }) => {
  return async (req, res, next) => {
    // Adicionar usuário premium por padrão
    req.user = {
      id: 'system-default',
      email: 'default@system.local',
      role: 'admin',
      isPremium: true,
      subscription: {
        status: 'ACTIVE',
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    };
    
    // Continuar sem verificação
    next();
  };
};

module.exports = { verifyAsaasSubscription }; 