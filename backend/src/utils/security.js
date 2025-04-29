/**
 * Utilitários de segurança para validação de requisições webhook
 */
const logger = require('./logger');

/**
 * Verifica se o IP de origem da requisição está na lista de IPs permitidos
 * 
 * @param {object} req - Objeto de requisição Express
 * @param {string[]} allowedIPs - Lista de IPs permitidos
 * @returns {object} Resultado da verificação
 */
function verifyIP(req, allowedIPs = []) {
  // Se não houver lista de IPs permitidos, permite qualquer IP
  if (!allowedIPs || !Array.isArray(allowedIPs) || allowedIPs.length === 0) {
    return { valid: true, ip: req.ip || req.connection.remoteAddress };
  }

  // Obtém o IP do cliente
  const clientIP = req.ip || 
                  req.connection.remoteAddress || 
                  req.socket.remoteAddress || 
                  req.headers['x-forwarded-for'] || 
                  'desconhecido';
  
  // Verifica se o IP está na lista de permitidos
  const isAllowed = allowedIPs.some(ip => {
    // Permite verificação parcial (comparação de prefixo)
    if (ip.endsWith('*')) {
      const prefix = ip.slice(0, -1);
      return clientIP.startsWith(prefix);
    }
    
    // Comparação exata
    return ip === clientIP;
  });

  logger.debug(`Verificação de IP: ${clientIP}`, { allowed: isAllowed });
  
  return {
    valid: isAllowed,
    ip: clientIP
  };
}

/**
 * Verifica o token de acesso no cabeçalho da requisição
 * 
 * @param {object} req - Objeto de requisição Express
 * @param {string} expectedToken - Token esperado para validação
 * @returns {object} Resultado da verificação
 */
function verifyToken(req, expectedToken) {
  // Se não houver token esperado, não valida
  if (!expectedToken) {
    return { valid: true, hasToken: false };
  }

  // Obtém o token do cabeçalho
  const token = req.headers['asaas-access-token'] || '';
  const isValid = token === expectedToken;

  logger.debug(`Verificação de token`, { 
    hasToken: !!token, 
    tokenLength: token.length, 
    valid: isValid 
  });

  return {
    valid: isValid,
    hasToken: !!token
  };
}

/**
 * Cria um middleware para validar segurança da requisição
 * 
 * @param {object} options - Opções de segurança
 * @returns {function} Middleware Express
 */
function createSecurityMiddleware(options = {}) {
  // Configurações padrão
  const securityConfig = {
    validateIP: options.validateIP || false,
    validateToken: options.validateToken || false,
    allowedIPs: options.allowedIPs || [],
    webhookToken: options.webhookToken || process.env.ASAAS_WEBHOOK_TOKEN
  };

  return (req, res, next) => {
    // Validação de IP, se habilitada
    if (securityConfig.validateIP && securityConfig.allowedIPs.length > 0) {
      const ipResult = verifyIP(req, securityConfig.allowedIPs);
      if (!ipResult.valid) {
        logger.warn('Acesso negado - IP não autorizado', { 
          ip: ipResult.ip, 
          path: req.path 
        });
        return res.status(403).json({ 
          error: 'Acesso negado',
          message: 'IP de origem não autorizado'
        });
      }
    }
    
    // Validação de token, se habilitada
    if (securityConfig.validateToken && req.method === 'POST') {
      const tokenResult = verifyToken(req, securityConfig.webhookToken);
      if (!tokenResult.valid) {
        logger.warn('Acesso negado - Token inválido', { 
          path: req.path, 
          hasToken: tokenResult.hasToken 
        });
        return res.status(401).json({ 
          error: 'Acesso negado',
          message: 'Token de acesso inválido ou ausente'
        });
      }
    }
    
    // Se passou por todas as validações, continua
    next();
  };
}

module.exports = {
  verifyIP,
  verifyToken,
  createSecurityMiddleware
}; 