/**
 * Utilitário para criptografia e descriptografia de dados
 * Usado para proteger dados enviados via SSE (Server-Sent Events)
 */

const crypto = require('crypto');

// Obter chave do ambiente ou usar fallback para desenvolvimento
const SECRET_KEY = process.env.SSE_ENCRYPTION_KEY || 'runcashh_sse_encryption_key_2023';
const IV_LENGTH = 16; // Para AES, este é o tamanho do IV 

/**
 * Criptografa dados para envio seguro via SSE
 * @param {Object} data - Dados a serem criptografados
 * @returns {String} Dados criptografados em formato "Fe26.2"
 */
const encryptData = (data) => {
  try {
    // Gerar um IV aleatório
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Criar um timestamp para evitar replay attacks
    const timestamp = Date.now();
    
    // Preparar dados com timestamp
    const payload = {
      data,
      timestamp,
      nonce: crypto.randomBytes(8).toString('hex') // Valor único para evitar ataques de replay
    };
    
    // Converter para string
    const text = JSON.stringify(payload);
    
    // Criar cipher usando algoritmo AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(SECRET_KEY), iv);
    
    // Criptografar dados
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Obter tag de autenticação
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Criar dados no formato "Fe26.2*versão*dados*IV*timestamp*tag*metadata"
    // Similar ao formato usado pelo tipminer
    const result = `Fe26.2*1*${encrypted}*${iv.toString('hex')}*${timestamp}*${authTag}*${Buffer.from(JSON.stringify({v:1})).toString('base64')}`;
    
    return result;
  } catch (error) {
    console.error('Erro ao criptografar dados:', error);
    throw new Error('Falha ao criptografar dados para stream');
  }
};

/**
 * Descriptografa dados recebidos em formato "Fe26.2"
 * @param {String} encryptedData - Dados criptografados
 * @returns {Object} Dados descriptografados
 */
const decryptData = (encryptedData) => {
  try {
    // Extrair partes do token
    const parts = encryptedData.split('*');
    
    if (parts.length < 6 || parts[0] !== 'Fe26.2') {
      throw new Error('Formato de token inválido');
    }
    
    const encrypted = parts[2];
    const iv = Buffer.from(parts[3], 'hex');
    const timestamp = parseInt(parts[4]);
    const authTag = Buffer.from(parts[5], 'hex');
    
    // Verificar se o token não expirou (opcional, configurável)
    const TOKEN_MAX_AGE = 60 * 60 * 1000; // 1 hora
    if (Date.now() - timestamp > TOKEN_MAX_AGE) {
      throw new Error('Token expirado');
    }
    
    // Criar decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(SECRET_KEY), iv);
    decipher.setAuthTag(authTag);
    
    // Descriptografar
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Converter para objeto
    const payload = JSON.parse(decrypted);
    
    return payload.data;
  } catch (error) {
    console.error('Erro ao descriptografar dados:', error);
    throw new Error('Falha ao descriptografar dados do stream');
  }
};

module.exports = {
  encryptData,
  decryptData
}; 