/**
 * Middleware para verificação de assinatura digital
 * Garante que requisições sejam autênticas e não tenham sido adulteradas
 */

const crypto = require('crypto');

/**
 * Verifica a assinatura HMAC da requisição
 * @param {Object} options - Opções de configuração
 * @param {String} options.secret - Chave secreta para verificação (padrão: process.env.API_SIGNATURE_SECRET)
 * @param {String} options.algorithm - Algoritmo de hash (padrão: sha256)
 * @param {String} options.signatureHeader - Nome do cabeçalho que contém a assinatura (padrão: 'x-signature')
 * @param {String} options.timestampHeader - Nome do cabeçalho que contém o timestamp (padrão: 'x-timestamp')
 * @param {Number} options.maxAge - Tempo máximo em segundos para validar a assinatura (padrão: 300 = 5 minutos)
 */
exports.verifySignature = (options = {}) => {
  // Configurações padrão
  const config = {
    secret: process.env.API_SIGNATURE_SECRET,
    algorithm: 'sha256',
    signatureHeader: 'x-signature',
    timestampHeader: 'x-timestamp',
    maxAge: 300, // 5 minutos
    ...options
  };

  return (req, res, next) => {
    try {
      // Obter a assinatura do cabeçalho
      const signature = req.headers[config.signatureHeader];
      if (!signature) {
        return res.status(401).json({
          success: false,
          message: 'Acesso negado. Assinatura não fornecida'
        });
      }

      // Obter o timestamp do cabeçalho
      const timestamp = req.headers[config.timestampHeader];
      if (!timestamp) {
        return res.status(401).json({
          success: false,
          message: 'Acesso negado. Timestamp não fornecido'
        });
      }

      // Verificar se o timestamp não expirou
      const now = Math.floor(Date.now() / 1000);
      const requestTime = parseInt(timestamp, 10);
      
      if (isNaN(requestTime)) {
        return res.status(401).json({
          success: false,
          message: 'Acesso negado. Timestamp inválido'
        });
      }
      
      if (now - requestTime > config.maxAge) {
        return res.status(401).json({
          success: false,
          message: 'Acesso negado. Requisição expirada'
        });
      }

      // Criar string para assinar com base no método, caminho, timestamp e corpo
      let body = '';
      
      if (req.method !== 'GET' && req.body) {
        body = typeof req.body === 'string' 
          ? req.body 
          : JSON.stringify(req.body);
      }
      
      const stringToSign = `${req.method}:${req.originalUrl}:${timestamp}:${body}`;
      
      // Gerar assinatura para comparação
      const expectedSignature = crypto
        .createHmac(config.algorithm, config.secret)
        .update(stringToSign)
        .digest('hex');
      
      // Verificar se as assinaturas correspondem
      if (signature !== expectedSignature) {
        return res.status(401).json({
          success: false,
          message: 'Acesso negado. Assinatura inválida'
        });
      }

      // Se chegou aqui, a assinatura é válida
      next();
    } catch (error) {
      console.error('Erro na verificação de assinatura:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno no servidor durante verificação de assinatura'
      });
    }
  };
};

/**
 * Gera uma assinatura para uso em clientes
 * Função auxiliar para testes e integração com clientes
 * @param {String} method - Método HTTP (GET, POST, etc)
 * @param {String} url - URL da requisição
 * @param {Object|String} body - Corpo da requisição
 * @param {String} secret - Chave secreta
 * @param {String} algorithm - Algoritmo de hash
 * @returns {Object} - Cabeçalhos necessários para autenticação
 */
exports.generateSignatureHeaders = (method, url, body = '', secret = process.env.API_SIGNATURE_SECRET, algorithm = 'sha256') => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  const stringToSign = `${method}:${url}:${timestamp}:${body ? bodyString : ''}`;
  
  const signature = crypto
    .createHmac(algorithm, secret)
    .update(stringToSign)
    .digest('hex');
  
  return {
    'x-signature': signature,
    'x-timestamp': timestamp
  };
}; 