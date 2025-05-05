/**
 * Utilitários para criptografia de dados da API
 * Usa a biblioteca iron-session para criptografia segura
 */

const { seal, unseal } = require('@hapi/iron');
const crypto = require('crypto');

// Chave secreta para criptografia - deve ser configurada no .env
// Mínimo 32 caracteres para segurança adequada
const SECRET_KEY = process.env.API_ENCRYPTION_KEY || 'ROULETTE_API_super_secret_key_at_least_32_chars';

// TTL (Time To Live) dos dados criptografados em milissegundos
// 1 hora por padrão
const DEFAULT_TTL = 60 * 60 * 1000; 

/**
 * Criptografa dados usando o formato Iron
 * @param {Object} data - Dados a serem criptografados
 * @param {Object} options - Opções de criptografia
 * @returns {Promise<string>} - String criptografada no formato Iron
 */
const encryptData = async (data, options = {}) => {
  try {
    const { ttl = DEFAULT_TTL } = options;
    
    // Adicionar timestamp para verificação de expiração
    const sealedData = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl
    };
    
    // Criptografar com Iron
    const encrypted = await seal(sealedData, SECRET_KEY, {
      ttl,
      encryption: { algorithm: 'aes256-cbc' }
    });
    
    return encrypted;
  } catch (error) {
    console.error('Erro ao criptografar dados:', error);
    throw new Error('Falha na criptografia dos dados');
  }
};

/**
 * Descriptografa dados no formato Iron
 * @param {string} encryptedData - Dados criptografados
 * @returns {Promise<Object>} - Dados descriptografados
 */
const decryptData = async (encryptedData) => {
  try {
    // Descriptografar com Iron
    const unsealed = await unseal(encryptedData, SECRET_KEY, {
      encryption: { algorithm: 'aes256-cbc' }
    });
    
    // Verificar expiração
    if (unsealed.expiresAt && unsealed.expiresAt < Date.now()) {
      throw new Error('Dados expirados');
    }
    
    return unsealed.data;
  } catch (error) {
    console.error('Erro ao descriptografar dados:', error);
    throw new Error('Falha na descriptografia dos dados');
  }
};

/**
 * Gera uma chave de acesso para o cliente
 * @param {String} userId - ID do usuário
 * @param {Object} subscriptionData - Dados da assinatura
 * @returns {Promise<string>} - Chave de acesso criptografada
 */
const generateAccessKey = async (userId, subscriptionData) => {
  try {
    const accessData = {
      userId,
      subscription: subscriptionData,
      createdAt: Date.now(),
      // Expira em 7 dias por padrão
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
    };
    
    // Criptografar a chave de acesso
    const accessKey = await seal(accessData, SECRET_KEY, {
      // TTL de 7 dias
      ttl: 7 * 24 * 60 * 60 * 1000,
      encryption: { algorithm: 'aes256-cbc' }
    });
    
    return accessKey;
  } catch (error) {
    console.error('Erro ao gerar chave de acesso:', error);
    throw new Error('Falha ao gerar chave de acesso');
  }
};

/**
 * Verifica uma chave de acesso
 * @param {String} accessKey - Chave de acesso criptografada
 * @returns {Promise<Object>} - Dados da chave de acesso
 */
const verifyAccessKey = async (accessKey) => {
  try {
    // Descriptografar a chave de acesso
    const keyData = await unseal(accessKey, SECRET_KEY, {
      encryption: { algorithm: 'aes256-cbc' }
    });
    
    // Verificar expiração
    if (keyData.expiresAt && keyData.expiresAt < Date.now()) {
      throw new Error('Chave de acesso expirada');
    }
    
    return keyData;
  } catch (error) {
    console.error('Erro ao verificar chave de acesso:', error);
    throw new Error('Chave de acesso inválida ou expirada');
  }
};

module.exports = {
  encryptData,
  decryptData,
  generateAccessKey,
  verifyAccessKey
}; 