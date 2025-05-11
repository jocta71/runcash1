const crypto = require('crypto');
const iron = require('@hapi/iron');

// Chave mestra para criptografia - em produção, use variáveis de ambiente
const MASTER_KEY = process.env.IRON_MASTER_KEY || 'wh4t3v3r-y0u-w4nt-th1s-t0-b3-32-ch4rs';

/**
 * Criptografa dados da roleta usando o formato Iron
 * @param {Object} data - Dados a serem criptografados (resultados da roleta)
 * @returns {Promise<string>} - String criptografada no formato Fe26.2
 */
const encryptRouletteData = async (data) => {
  try {
    // Adiciona timestamp para prevenir ataques de replay
    const dataWithTimestamp = {
      ...data,
      timestamp: Date.now()
    };
    
    // Criptografa usando Iron (formato Fe26.2)
    const sealed = await iron.seal(dataWithTimestamp, MASTER_KEY, iron.defaults);
    return sealed;
  } catch (error) {
    console.error('Erro ao criptografar dados:', error);
    throw new Error('Falha na criptografia dos dados');
  }
};

/**
 * Descriptografa dados da roleta
 * @param {string} sealedData - Dados criptografados no formato Fe26.2
 * @returns {Promise<Object>} - Dados originais descriptografados
 */
const decryptRouletteData = async (sealedData) => {
  try {
    const unsealed = await iron.unseal(sealedData, MASTER_KEY, iron.defaults);
    return unsealed;
  } catch (error) {
    console.error('Erro ao descriptografar dados:', error);
    throw new Error('Falha na descriptografia dos dados');
  }
};

/**
 * Gera uma chave de cliente para um usuário específico
 * @param {string} userId - ID do usuário
 * @param {Object} permissions - Permissões do usuário
 * @returns {Promise<string>} - Chave de cliente criptografada
 */
const generateClientKey = async (userId, permissions) => {
  try {
    const clientKey = {
      userId,
      permissions,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 horas
      keyId: crypto.randomBytes(8).toString('hex')
    };
    
    return await iron.seal(clientKey, MASTER_KEY, iron.defaults);
  } catch (error) {
    console.error('Erro ao gerar chave de cliente:', error);
    throw new Error('Falha na geração da chave de cliente');
  }
};

/**
 * Verifica se a chave do cliente é válida
 * @param {string} clientKey - Chave criptografada do cliente
 * @returns {Promise<Object|null>} - Detalhes da chave ou null se inválida
 */
const verifyClientKey = async (clientKey) => {
  try {
    const key = await iron.unseal(clientKey, MASTER_KEY, iron.defaults);
    
    // Verifica se a chave expirou
    if (key.expiresAt < Date.now()) {
      return null;
    }
    
    return key;
  } catch (error) {
    console.error('Erro ao verificar chave de cliente:', error);
    return null;
  }
};

module.exports = {
  encryptRouletteData,
  decryptRouletteData,
  generateClientKey,
  verifyClientKey
}; 