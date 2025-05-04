/**
 * Serviço de criptografia para dados sensíveis
 * Utiliza a biblioteca Iron da Hapi para criptografar e verificar dados
 */

const Iron = require('@hapi/iron');
const crypto = require('crypto');

// Chave de criptografia - em produção deve vir de variável de ambiente
const defaultSecretKey = process.env.IRON_SECRET_KEY || crypto.randomBytes(32).toString('hex');
console.log(`[CRYPTO] Chave de criptografia inicializada: ${defaultSecretKey.substring(0, 8)}...`);

// Opções padrão para a criptografia Iron
const defaultOptions = {
  ttl: 5 * 60 * 1000, // 5 minutos
  timestampSkewSec: 60, // 1 minuto de tolerância para relógios dessincronizados
  encryption: { saltBits: 256 } // Aumentar segurança do salt
};

/**
 * Criptografa dados usando Iron
 * @param {Object} data - Dados a serem criptografados
 * @param {String} [password] - Senha personalizada (opcional)
 * @param {Object} [options] - Opções de configuração
 * @returns {Promise<String>} - Dados criptografados
 */
async function encrypt(data, password = defaultSecretKey, options = {}) {
  const ironOptions = { ...defaultOptions, ...options };
  try {
    const sealed = await Iron.seal(data, password, ironOptions);
    return sealed;
  } catch (error) {
    console.error('[CRYPTO] Erro ao criptografar dados:', error);
    throw new Error('Falha ao criptografar dados');
  }
}

/**
 * Descriptografa dados usando Iron
 * @param {String} sealed - Dados criptografados
 * @param {String} [password] - Senha para descriptografia (opcional)
 * @param {Object} [options] - Opções de configuração
 * @returns {Promise<Object>} - Dados descriptografados
 */
async function decrypt(sealed, password = defaultSecretKey, options = {}) {
  const ironOptions = { ...defaultOptions, ...options };
  try {
    const unsealed = await Iron.unseal(sealed, password, ironOptions);
    return unsealed;
  } catch (error) {
    console.error('[CRYPTO] Erro ao descriptografar dados:', error);
    throw new Error('Falha ao descriptografar dados');
  }
}

/**
 * Gera uma nova chave de criptografia
 * @param {Number} [size=32] - Tamanho da chave em bytes
 * @returns {String} - Nova chave em formato hexadecimal
 */
function generateKey(size = 32) {
  return crypto.randomBytes(size).toString('hex');
}

module.exports = {
  encrypt,
  decrypt,
  generateKey
}; 