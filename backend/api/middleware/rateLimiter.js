/**
 * Middleware para limitar a taxa de requisições
 * Implementação simplificada baseada em memória
 */

// Armazenamento de requisições (em produção, usar Redis ou similar)
const requestStore = {
  ipRequests: {},
  userRequests: {},
  lastCleanup: Date.now()
};

// Configurações padrão
const DEFAULT_WINDOW = 60 * 1000; // 1 minuto
const DEFAULT_MAX_REQUESTS = 30;  // 30 requisições por minuto
const CLEANUP_INTERVAL = 10 * 60 * 1000; // Limpar a cada 10 minutos

/**
 * Limpa entradas antigas do armazenamento de requisições
 */
function cleanupStore() {
  const now = Date.now();
  
  // Só limpar a cada CLEANUP_INTERVAL
  if (now - requestStore.lastCleanup < CLEANUP_INTERVAL) {
    return;
  }
  
  console.log('[RateLimiter] Realizando limpeza do armazenamento');
  
  const cutoff = now - (CLEANUP_INTERVAL * 2); // Remover entradas mais antigas que 20 minutos
  
  // Limpar entradas por IP
  Object.keys(requestStore.ipRequests).forEach(ip => {
    requestStore.ipRequests[ip] = requestStore.ipRequests[ip].filter(
      timestamp => timestamp > cutoff
    );
    
    if (requestStore.ipRequests[ip].length === 0) {
      delete requestStore.ipRequests[ip];
    }
  });
  
  // Limpar entradas por usuário
  Object.keys(requestStore.userRequests).forEach(userId => {
    requestStore.userRequests[userId] = requestStore.userRequests[userId].filter(
      timestamp => timestamp > cutoff
    );
    
    if (requestStore.userRequests[userId].length === 0) {
      delete requestStore.userRequests[userId];
    }
  });
  
  requestStore.lastCleanup = now;
}

/**
 * Cria um middleware de rate limiting
 * @param {Object} options - Opções de configuração
 * @param {number} [options.windowMs] - Janela de tempo em ms
 * @param {number} [options.maxRequests] - Máximo de requisições permitidas
 * @param {boolean} [options.userBased] - Se true, limite por usuário, caso contrário por IP
 * @returns {Function} Express middleware
 */
exports.createRateLimiter = function(options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW;
  const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
  const userBased = options.userBased === undefined ? true : options.userBased;
  
  return function(req, res, next) {
    const now = Date.now();
    
    // Limpar armazenamento se necessário
    cleanupStore();
    
    // Determinar chave com base no tipo de limitação (IP ou usuário)
    let key;
    let store;
    
    if (userBased && req.user && req.user.id) {
      key = req.user.id;
      store = requestStore.userRequests;
    } else {
      key = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      store = requestStore.ipRequests;
    }
    
    // Inicializar array de timestamps se não existir
    if (!store[key]) {
      store[key] = [];
    }
    
    // Remover timestamps antigos (fora da janela atual)
    const windowStart = now - windowMs;
    store[key] = store[key].filter(timestamp => timestamp > windowStart);
    
    // Verificar se excedeu o limite
    if (store[key].length >= maxRequests) {
      console.warn(`[RateLimiter] Limite excedido para ${userBased ? 'usuário' : 'IP'}: ${key}`);
      return res.status(429).json({
        error: 'Muitas requisições',
        message: 'Por favor, aguarde antes de tentar novamente',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    // Adicionar timestamp atual
    store[key].push(now);
    
    // Adicionar headers de rate limit
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - store[key].length);
    res.setHeader('X-RateLimit-Reset', Math.ceil((windowStart + windowMs) / 1000));
    
    next();
  };
};

/**
 * Rate limiter específico para APIs de pagamento
 * Mais restritivo para operações sensíveis
 */
exports.paymentApiLimiter = exports.createRateLimiter({
  windowMs: 5 * 60 * 1000,   // 5 minutos
  maxRequests: 20,           // 20 requisições
  userBased: true            // Limitar por usuário se autenticado
});

/**
 * Rate limiter mais restritivo para tentativas de pagamento
 * Para proteger contra abuso de APIs de criação de pagamentos
 */
exports.paymentCreationLimiter = exports.createRateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  maxRequests: 5,            // 5 requisições
  userBased: true            // Limitar por usuário se autenticado
});

/**
 * Rate limiter para webhook
 * Protege contra spamming de webhooks
 */
exports.webhookLimiter = exports.createRateLimiter({
  windowMs: 1 * 60 * 1000,   // 1 minuto
  maxRequests: 60,           // 60 requisições por minuto
  userBased: false           // Limitar por IP, não por usuário
}); 