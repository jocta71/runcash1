const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');

// Cache para conexão do banco de dados
let cachedDb = null;

/**
 * Conecta ao banco de dados MongoDB
 * @returns {Promise<Object>} Objeto com a conexão e o banco de dados
 */
async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = await MongoClient.connect(config.db.uri, config.db.options);
  const db = client.db();
  
  cachedDb = {
    client,
    db
  };
  
  return cachedDb;
}

/**
 * Configura os cabeçalhos CORS para a resposta
 * @param {Object} res - Objeto de resposta
 */
function setCorsHeaders(res) {
  const { origin, methods, allowedHeaders } = config.security.cors;
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/**
 * Verifica e decodifica um token JWT
 * @param {string} token - Token JWT para verificar
 * @returns {Promise<Object>} Payload decodificado do token
 */
async function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.auth.jwtSecret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
}

/**
 * Autentica um usuário usando o token JWT
 * @param {Object} req - Objeto de requisição
 * @returns {Promise<Object>} Informações do usuário autenticado
 */
async function authenticate(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token de autenticação não fornecido');
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = await verifyToken(token);
  
  const { db } = await connectToDatabase();
  const user = await db.collection(config.db.collections.users).findOne({ _id: new ObjectId(decoded.userId) });
  
  if (!user) {
    throw new Error('Usuário não encontrado');
  }
  
  return user;
}

/**
 * Registra uma ação de auditoria no sistema
 * @param {Object} data - Dados da ação para registro
 * @param {string} data.userId - ID do usuário que realizou a ação
 * @param {string} data.action - Tipo de ação (create, update, delete, etc)
 * @param {string} data.resource - Recurso afetado (user, transaction, account, etc)
 * @param {string} data.resourceId - ID do recurso afetado
 * @param {Object} data.oldData - Estado anterior dos dados (opcional)
 * @param {Object} data.newData - Novo estado dos dados (opcional)
 */
async function logAudit({ userId, action, resource, resourceId, oldData, newData }) {
  const { db } = await connectToDatabase();
  
  await db.collection(config.db.collections.auditLogs).insertOne({
    userId: typeof userId === 'string' ? new ObjectId(userId) : userId,
    action,
    resource,
    resourceId: resourceId ? (typeof resourceId === 'string' ? new ObjectId(resourceId) : resourceId) : null,
    oldData,
    newData,
    timestamp: new Date(),
    ipAddress: null, // Em produção, armazenar o IP do cliente
    userAgent: null  // Em produção, armazenar o user-agent
  });
}

/**
 * Gera resposta de erro formatada
 * @param {Object} res - Objeto de resposta
 * @param {number} statusCode - Código de status HTTP
 * @param {string} message - Mensagem de erro
 * @param {Object} details - Detalhes adicionais do erro (opcional)
 */
function errorResponse(res, statusCode, message, details = null) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      details
    }
  });
}

/**
 * Gera resposta de sucesso formatada
 * @param {Object} res - Objeto de resposta
 * @param {number} statusCode - Código de status HTTP
 * @param {string} message - Mensagem de sucesso
 * @param {Object} data - Dados para incluir na resposta
 */
function successResponse(res, statusCode, message, data = null) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

/**
 * Valida um endereço de email
 * @param {string} email - Email para validar
 * @returns {boolean} Resultado da validação
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Valida uma data no formato YYYY-MM-DD
 * @param {string} dateString - String de data para validar
 * @returns {boolean} Resultado da validação
 */
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!regex.test(dateString)) {
    return false;
  }
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * Sanitiza um objeto, removendo campos não permitidos
 * @param {Object} obj - Objeto para sanitizar
 * @param {Array<string>} allowedFields - Lista de campos permitidos
 * @returns {Object} Objeto sanitizado
 */
function sanitizeObject(obj, allowedFields) {
  const sanitized = {};
  
  for (const field of allowedFields) {
    if (obj.hasOwnProperty(field)) {
      sanitized[field] = obj[field];
    }
  }
  
  return sanitized;
}

/**
 * Converte uma string para ObjectId do MongoDB
 * @param {string} id - ID para converter
 * @returns {ObjectId} ID convertido para ObjectId
 */
function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch (error) {
    throw new Error('ID inválido');
  }
}

/**
 * Gera um token JWT para o usuário
 * @param {string} userId - ID do usuário
 * @param {Object} additionalClaims - Claims adicionais para o token (opcional)
 * @returns {string} Token JWT gerado
 */
function generateToken(userId, additionalClaims = {}) {
  const payload = {
    userId,
    ...additionalClaims
  };
  
  return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpire });
}

/**
 * Hash de senha utilizando bcrypt
 * @param {string} password - Senha para realizar hash
 * @returns {Promise<string>} Hash da senha
 */
async function hashPassword(password) {
  return bcrypt.hash(password, config.security.bcryptRounds);
}

/**
 * Compara senha com hash armazenado
 * @param {string} password - Senha para comparar
 * @param {string} hashedPassword - Hash armazenado
 * @returns {Promise<boolean>} Resultado da comparação
 */
async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Formata um valor monetário
 * @param {number} value - Valor para formatar
 * @param {string} currency - Código da moeda (padrão: BRL)
 * @returns {string} Valor formatado
 */
function formatCurrency(value, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency
  }).format(value);
}

/**
 * Calcula a diferença entre duas datas em dias
 * @param {Date} date1 - Primeira data
 * @param {Date} date2 - Segunda data
 * @returns {number} Diferença em dias
 */
function daysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000; // Milissegundos em um dia
  return Math.round(Math.abs((date1 - date2) / oneDay));
}

/**
 * Captura e processa erros de API
 * @param {Function} handler - Função manipuladora da requisição
 * @returns {Function} Função processadora com tratamento de erro
 */
function catchAsync(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Erro na API:', error);
      
      // Determina o código de status apropriado
      let statusCode = 500;
      if (error.message.includes('não encontrado') || error.message.includes('not found')) {
        statusCode = 404;
      } else if (error.message.includes('não autorizado') || error.message.includes('unauthorized')) {
        statusCode = 401;
      } else if (error.message.includes('proibido') || error.message.includes('forbidden')) {
        statusCode = 403;
      } else if (error.message.includes('inválido') || error.message.includes('invalid')) {
        statusCode = 400;
      }
      
      errorResponse(res, statusCode, error.message);
    }
  };
}

module.exports = {
  connectToDatabase,
  setCorsHeaders,
  verifyToken,
  authenticate,
  logAudit,
  errorResponse,
  successResponse,
  isValidEmail,
  isValidDate,
  sanitizeObject,
  toObjectId,
  generateToken,
  hashPassword,
  comparePassword,
  formatCurrency,
  daysBetween,
  catchAsync
}; 