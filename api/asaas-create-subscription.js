// Endpoint de criação de assinatura no Asaas para Vercel
const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

// Cache simples para implementar rate limiting
const rateLimitCache = {
  requests: {},
  resetTime: Date.now() + 3600000, // Reset a cada hora
  limit: 20 // Limite de 20 requisições por IP por hora
};

// Função para verificar rate limiting
const checkRateLimit = (ip) => {
  // Reset cache se necessário
  if (Date.now() > rateLimitCache.resetTime) {
    rateLimitCache.requests = {};
    rateLimitCache.resetTime = Date.now() + 3600000;
  }
  
  // Inicializar contador para este IP
  if (!rateLimitCache.requests[ip]) {
    rateLimitCache.requests[ip] = 0;
  }
  
  // Incrementar contador
  rateLimitCache.requests[ip]++;
  
  // Verificar se excedeu o limite
  return rateLimitCache.requests[ip] <= rateLimitCache.limit;
};

// Função para verificar autenticação JWT
const authenticateToken = (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Token de autenticação não fornecido' };
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return { success: false, error: 'Token de autenticação inválido' };
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'runcash-default-secret');
    return { success: true, user: decoded };
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    return { success: false, error: 'Token inválido ou expirado' };
  }
};

// Redirecionador para a criação de assinaturas no Asaas
const redirector = require('./api-redirector');

module.exports = redirector; 