/**
 * Middleware para criptografar dados de resposta
 * Permite que as rotas sejam públicas com dados protegidos por criptografia
 */

const Iron = require('@hapi/iron');
const crypto = require('crypto');

// Chave de criptografia (deve ser uma string de pelo menos 32 caracteres)
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || 'runcashh_data_encryption_secret_key_32ch';

/**
 * Configuração do Iron
 * ttl: Tempo de vida do token em milissegundos (24 horas)
 */
const ironOptions = {
  ttl: 24 * 60 * 60 * 1000,
  contextInfo: 'RunCashRouletteData'
};

/**
 * Middleware para criptografar dados de resposta
 * Use este middleware para criptografar os dados antes de enviá-los ao cliente
 */
const encryptResponseData = async (req, res, next) => {
  // Armazenar o método json original
  const originalJson = res.json;
  
  // Substituir o método json com nossa versão que criptografa os dados
  res.json = async function(data) {
    try {
      console.log(`[ENCRYPT] Criptografando dados para resposta`);
      
      // Adicionar timestamp para evitar replay attacks
      const payload = {
        data,
        timestamp: Date.now()
      };
      
      // Criptografar os dados com Iron
      const encryptedData = await Iron.seal(payload, ENCRYPTION_KEY, Iron.defaults);
      
      // Gerar ID para debugging e formato similar ao concorrente
      const requestId = crypto.randomBytes(4).toString('hex');
      
      // Criar resposta no formato similar ao observado no concorrente
      const responseFormat = {
        event: "update",
        id: Math.floor(Math.random() * 10) + 1, // Um número aleatório entre 1 e 10
        data: `Fe26_${crypto.randomBytes(8).toString('hex')}${encryptedData}`
      };
      
      // Responder com dados criptografados
      return originalJson.call(this, responseFormat);
    } catch (error) {
      console.error('[ENCRYPT] Erro ao criptografar dados:', error);
      
      // Em caso de erro, retornar erro 500
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar resposta',
        error: 'ENCRYPTION_ERROR'
      });
    }
  };
  
  next();
};

/**
 * Utilitário para descriptografar dados no frontend
 * Esta função será implementada no frontend
 */
const decryptData = async (encryptedData, key) => {
  try {
    // Remover o prefixo Fe26_ e qualquer parte do hash adicional
    const cleanData = encryptedData.replace(/^Fe26_[a-f0-9]{16}/, '');
    const decrypted = await Iron.unseal(cleanData, key, Iron.defaults);
    return decrypted.data;
  } catch (error) {
    console.error('Erro ao descriptografar dados:', error);
    throw new Error('Falha ao descriptografar dados');
  }
};

module.exports = {
  encryptResponseData,
  decryptData
}; 