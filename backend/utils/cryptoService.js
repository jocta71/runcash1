/**
 * Serviço de criptografia para proteger dados da API pública
 * Implementa o formato Fe26.2 similar ao do concorrente
 */

const crypto = require('crypto');

// Chaves secretas - em produção, devem ser armazenadas como variáveis de ambiente
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'seu_secret_key_com_pelo_menos_32_caracteres';
const IV_LENGTH = 16; // Para AES, isso é sempre 16
const AUTH_TAG_LENGTH = 16; // Para GCM, comprimento padrão

/**
 * Criptografa dados usando AES-256-GCM e formata no estilo Fe26.2
 * @param {Object} data - Dados a serem criptografados
 * @param {Object} options - Opções de criptografia
 * @returns {String} - Dados criptografados no formato Fe26.2*[version]*[encrypted]*[iv]*[timestamp]*[tag]
 */
function encryptData(data, options = {}) {
  try {
    // Gerar IV aleatório
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Criar cifra
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    
    // Converter dados para string JSON
    const jsonData = JSON.stringify(data);
    
    // Criptografar dados
    let encrypted = cipher.update(jsonData, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Obter tag de autenticação
    const authTag = cipher.getAuthTag().toString('base64');
    
    // Gerar timestamp
    const timestamp = Date.now().toString();
    
    // Gerar versão para compatibilidade com o formato Fe26.2
    const version = '1';
    
    // Construir token no formato Fe26.2
    const token = `Fe26.2*${version}*${encrypted}*${iv.toString('base64')}*${timestamp}*${authTag}`;
    
    return token;
  } catch (error) {
    console.error('Erro ao criptografar dados:', error);
    throw new Error('Falha ao criptografar dados');
  }
}

/**
 * Descriptografa dados no formato Fe26.2
 * @param {String} token - Token criptografado
 * @returns {Object} - Dados descriptografados
 */
function decryptData(token) {
  try {
    // Validar formato do token
    if (!token || !token.startsWith('Fe26.2*')) {
      throw new Error('Formato de token inválido');
    }
    
    // Extrair partes do token
    const parts = token.split('*');
    if (parts.length < 6) {
      throw new Error('Token incompleto');
    }
    
    const [prefix, version, encrypted, ivBase64, timestamp, authTagBase64] = parts;
    
    // Converter IV e tag de autenticação de base64 para Buffer
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    // Criar decifragem
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    
    // Configurar tag de autenticação
    decipher.setAuthTag(authTag);
    
    // Descriptografar dados
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Converter JSON para objeto
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Erro ao descriptografar dados:', error);
    throw new Error('Falha ao descriptografar dados');
  }
}

module.exports = {
  encryptData,
  decryptData
}; 