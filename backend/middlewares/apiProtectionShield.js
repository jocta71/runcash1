/**
 * API Protection Shield - Middleware avançado de proteção para endpoints críticos
 * 
 * Este middleware implementa várias camadas de proteção:
 * 1. Rate limiting para prevenir abuso
 * 2. Verificação de integridade do token JWT 
 * 3. Verificação de IP e User-Agent para prevenir roubo de tokens
 * 4. Tempo de expiração de token mais rigoroso
 * 5. Proteção contra ataques de timing
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Cache de requisições para rate limiting
const requestCache = {
  byIP: {},
  byToken: {},
  byUserAgent: {}
};

// Limpa o cache a cada hora para evitar vazamento de memória
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  
  // Limpar entradas antigas
  Object.keys(requestCache.byIP).forEach(key => {
    if (requestCache.byIP[key].timestamp < oneHourAgo) {
      delete requestCache.byIP[key];
    }
  });
  
  Object.keys(requestCache.byToken).forEach(key => {
    if (requestCache.byToken[key].timestamp < oneHourAgo) {
      delete requestCache.byToken[key];
    }
  });
  
  Object.keys(requestCache.byUserAgent).forEach(key => {
    if (requestCache.byUserAgent[key].timestamp < oneHourAgo) {
      delete requestCache.byUserAgent[key];
    }
  });
  
}, 3600000); // Limpar a cada hora

// Verifica se há muitas requisições em um curto período
function isRateLimited(identifier, cache, limit, timeWindow) {
  const now = Date.now();
  
  if (!cache[identifier]) {
    cache[identifier] = {
      count: 1,
      timestamp: now,
      firstRequest: now
    };
    return false;
  }
  
  // Atualizar contador
  cache[identifier].count++;
  cache[identifier].timestamp = now;
  
  // Verificar se excedeu o limite na janela de tempo
  const timeElapsed = now - cache[identifier].firstRequest;
  if (timeElapsed < timeWindow && cache[identifier].count > limit) {
    return true;
  }
  
  // Resetar contador se janela de tempo passou
  if (timeElapsed >= timeWindow) {
    cache[identifier].count = 1;
    cache[identifier].firstRequest = now;
  }
  
  return false;
}

// Introduz um atraso aleatório para prevenir ataques de timing
function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Função principal do middleware
function apiProtectionShield(options = {}) {
  const {
    ipRateLimit = 60,           // Máximo de requisições por IP em 1 minuto
    tokenRateLimit = 120,       // Máximo de requisições por token em 1 minuto
    userAgentRateLimit = 150,   // Máximo de requisições por User-Agent em 1 minuto
    timeWindow = 60000,         // Janela de tempo para rate limiting (1 minuto)
    strictTokenTimeCheck = true // Verificar tempo de emissão do token de forma mais rigorosa
  } = options;
  
  return async (req, res, next) => {
    // Gerar ID único para esta requisição
    const requestId = crypto.randomBytes(8).toString('hex');
    console.log(`[SHIELD ${requestId}] Nova requisição ${req.method} ${req.path}`);
    
    // Adicionar ID da requisição aos headers de resposta para debugging
    res.setHeader('X-Request-ID', requestId);
    
    try {
      // 1. Extrair informações da requisição
      const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'] || 'unknown';
      let tokenHash = 'no-token';
      let userId = null;
      
      // 2. Verificar token JWT (se presente)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        
        try {
          // Usar hash do token para rate limiting sem expor o token completo nos logs
          tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
          
          // Verificar token JWT
          const secret = process.env.JWT_SECRET || 'runcashh_secret_key';
          const decoded = jwt.verify(token, secret);
          
          if (decoded && decoded.id) {
            userId = decoded.id;
            
            // Verificação mais rigorosa de tempo do token
            if (strictTokenTimeCheck && decoded.iat) {
              const tokenAge = Math.floor(Date.now() / 1000) - decoded.iat;
              const maxAge = 86400; // 24 horas em segundos
              
              if (tokenAge > maxAge) {
                console.log(`[SHIELD ${requestId}] Token muito antigo (${tokenAge}s), emitido há mais de ${maxAge}s`);
                // Introduzir atraso aleatório para prevenir ataques de timing
                await randomDelay(50, 150);
                return res.status(401).json({ 
                  success: false, 
                  message: 'Token expirado. Por favor, faça login novamente.',
                  code: 'TOKEN_TOO_OLD',
                  requestId
                });
              }
            }
          }
        } catch (err) {
          console.log(`[SHIELD ${requestId}] Erro ao verificar token: ${err.message}`);
          // Não retornamos erro aqui para permitir que o middleware de auth padrão lide com isso
        }
      }
      
      // 3. Rate limiting por IP
      if (isRateLimited(ip, requestCache.byIP, ipRateLimit, timeWindow)) {
        console.log(`[SHIELD ${requestId}] Rate limit excedido para IP: ${ip}`);
        await randomDelay(200, 500);
        return res.status(429).json({ 
          success: false, 
          message: 'Muitas requisições. Por favor, tente novamente mais tarde.',
          code: 'RATE_LIMIT_IP',
          requestId
        });
      }
      
      // 4. Rate limiting por token (se presente)
      if (tokenHash !== 'no-token' && 
          isRateLimited(tokenHash, requestCache.byToken, tokenRateLimit, timeWindow)) {
        console.log(`[SHIELD ${requestId}] Rate limit excedido para token: ${tokenHash}`);
        await randomDelay(200, 500);
        return res.status(429).json({ 
          success: false, 
          message: 'Muitas requisições. Por favor, tente novamente mais tarde.',
          code: 'RATE_LIMIT_TOKEN',
          requestId
        });
      }
      
      // 5. Rate limiting por User-Agent
      if (isRateLimited(userAgent.substring(0, 100), requestCache.byUserAgent, userAgentRateLimit, timeWindow)) {
        console.log(`[SHIELD ${requestId}] Rate limit excedido para User-Agent: ${userAgent.substring(0, 50)}...`);
        await randomDelay(200, 500);
        return res.status(429).json({ 
          success: false, 
          message: 'Muitas requisições. Por favor, tente novamente mais tarde.',
          code: 'RATE_LIMIT_USER_AGENT',
          requestId
        });
      }
      
      // 6. Verificar padrões suspeitos de requisição
      const path = req.path.toLowerCase();
      if (
        (path.includes('roulette') || path.includes('roleta')) && 
        (!userId && req.method === 'GET')
      ) {
        console.log(`[SHIELD ${requestId}] Padrão suspeito: Tentativa de acesso a rota de roleta sem autenticação`);
        // Log avançado para detecção de padrão
        console.log(`[SHIELD ${requestId}] Detalhes: IP=${ip}, UA=${userAgent.substring(0, 50)}...`);
      }
      
      // Tudo OK, passar para o próximo middleware
      console.log(`[SHIELD ${requestId}] Requisição passou por todas as verificações de proteção`);
      next();
      
    } catch (error) {
      console.error(`[SHIELD ${requestId}] Erro no middleware de proteção: ${error.message}`);
      next(error); // Passar erro para o handler de erros do Express
    }
  };
}

module.exports = apiProtectionShield; 