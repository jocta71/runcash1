/**
 * Utilitários compartilhados para funções serverless
 * Centraliza lógica comum para autenticação, validação e resposta
 */

const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configurações
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'runcash';
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Cache para conexão com MongoDB
let cachedDb = null;

/**
 * Conecta ao MongoDB
 * @returns {Promise<object>} Cliente MongoDB conectado
 */
async function connectToMongoDB() {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    const db = client.db(DB_NAME);
    cachedDb = db;
    return db;
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    throw new Error('Falha na conexão com o banco de dados');
  }
}

/**
 * Configura cabeçalhos CORS para a resposta
 * @param {object} res - Objeto de resposta HTTP
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
}

/**
 * Processa requisições OPTIONS (pre-flight)
 * @param {object} req - Objeto de requisição HTTP
 * @param {object} res - Objeto de resposta HTTP
 * @returns {boolean} True se a requisição foi OPTIONS e já respondida
 */
function handleOptions(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  
  return false;
}

/**
 * Valida se o método HTTP é permitido
 * @param {object} req - Objeto de requisição HTTP
 * @param {object} res - Objeto de resposta HTTP
 * @param {string|string[]} allowedMethods - Método(s) permitido(s)
 * @returns {boolean} False se o método não é permitido
 */
function validateMethod(req, res, allowedMethods) {
  const methods = Array.isArray(allowedMethods) ? allowedMethods : [allowedMethods];
  
  if (!methods.includes(req.method)) {
    res.status(405).json({
      status: 'error',
      message: `Método ${req.method} não permitido. Use ${methods.join(' ou ')}`
    });
    return false;
  }
  
  return true;
}

/**
 * Valida campos obrigatórios
 * @param {object} data - Dados a serem validados
 * @param {string[]} requiredFields - Lista de campos obrigatórios
 * @returns {object|null} Objeto de erro ou null se válido
 */
function validateRequiredFields(data, requiredFields) {
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    return {
      status: 'error',
      message: 'Campos obrigatórios não informados',
      missingFields
    };
  }
  
  return null;
}

/**
 * Extrai Token JWT da requisição
 * @param {object} req - Objeto de requisição HTTP
 * @returns {string|null} Token JWT ou null se não encontrado
 */
function extractToken(req) {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }
  
  return null;
}

/**
 * Verifica e decodifica token JWT
 * @param {string} token - Token JWT
 * @returns {object} Payload decodificado ou erro
 */
function verifyToken(token) {
  try {
    return { 
      valid: true, 
      decoded: jwt.verify(token, JWT_SECRET)
    };
  } catch (error) {
    return { 
      valid: false, 
      error: error.message 
    };
  }
}

/**
 * Cliente Asaas com configuração padrão
 * @returns {object} Cliente Axios configurado para Asaas
 */
function asaasClient() {
  return axios.create({
    baseURL: ASAAS_API_URL,
    headers: {
      'access_token': ASAAS_API_KEY,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Formata resposta de erro
 * @param {object} res - Objeto de resposta HTTP
 * @param {number} statusCode - Código HTTP
 * @param {string} message - Mensagem de erro
 * @param {object} details - Detalhes adicionais do erro
 */
function errorResponse(res, statusCode, message, details = null) {
  const response = {
    status: 'error',
    message
  };
  
  if (details) {
    response.details = details;
  }
  
  return res.status(statusCode).json(response);
}

/**
 * Formata resposta de sucesso
 * @param {object} res - Objeto de resposta HTTP
 * @param {object} data - Dados de resposta
 * @param {number} statusCode - Código HTTP (default: 200)
 */
function successResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    status: 'success',
    data
  });
}

/**
 * Converte string para ObjectId MongoDB se válido
 * @param {string} id - String a ser convertida
 * @returns {ObjectId|string} ObjectId ou string original
 */
function toObjectId(id) {
  try {
    if (ObjectId.isValid(id)) {
      return new ObjectId(id);
    }
    return id;
  } catch (error) {
    return id;
  }
}

// Exportar utilitários
module.exports = {
  connectToMongoDB,
  setCorsHeaders,
  handleOptions,
  validateMethod,
  validateRequiredFields,
  extractToken,
  verifyToken,
  asaasClient,
  errorResponse,
  successResponse,
  toObjectId
}; 