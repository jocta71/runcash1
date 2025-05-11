/**
 * Middleware para limitar a taxa de requisições (rate limiting)
 * Protege a API contra abusos e ataques de força bruta
 */

/**
 * Armazenamento em memória para limites de requisições
 * Em produção, considere usar Redis ou outro armazenamento distribuído
 */
const requestStore = {
  ips: new Map(),
  cleanup: function() {
    const now = Date.now();
    for (const [ip, data] of this.ips.entries()) {
      if (now > data.resetTime) {
        this.ips.delete(ip);
      }
    }
  }
};

// Executar limpeza a cada 5 minutos
setInterval(() => requestStore.cleanup(), 5 * 60 * 1000);

/**
 * Middleware de rate limiting baseado em IP
 * @param {Object} options - Opções de configuração
 * @param {Number} options.windowMs - Período de tempo em milissegundos (padrão: 15 minutos)
 * @param {Number} options.max - Número máximo de requisições permitidas no período (padrão: 100)
 * @param {Function} options.keyGenerator - Função para gerar a chave (padrão: IP do cliente)
 * @param {Boolean} options.headers - Se deve incluir cabeçalhos de rate limit (padrão: true)
 * @param {String} options.message - Mensagem de erro quando limite é excedido
 * @param {Number} options.statusCode - Código de status HTTP quando limite é excedido (padrão: 429)
 */
exports.rateLimit = (options = {}) => {
  const config = {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limite de 100 requisições
    keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    headers: true,
    message: 'Muitas requisições, por favor tente novamente mais tarde',
    statusCode: 429,
    ...options
  };

  return (req, res, next) => {
    const key = config.keyGenerator(req);
    const now = Date.now();

    // Inicializar ou obter dados do IP
    if (!requestStore.ips.has(key)) {
      requestStore.ips.set(key, {
        count: 0,
        resetTime: now + config.windowMs
      });
    }

    const data = requestStore.ips.get(key);
    
    // Reiniciar contador se tempo expirou
    if (now > data.resetTime) {
      data.count = 0;
      data.resetTime = now + config.windowMs;
    }

    // Incrementar contador
    data.count += 1;

    // Calcular valores para cabeçalhos
    const remaining = Math.max(0, config.max - data.count);
    const reset = Math.ceil((data.resetTime - now) / 1000);

    // Adicionar cabeçalhos se configurados
    if (config.headers) {
      res.setHeader('X-RateLimit-Limit', config.max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', reset);
    }

    // Verificar se limite foi excedido
    if (data.count > config.max) {
      return res.status(config.statusCode).json({
        success: false,
        message: config.message
      });
    }

    next();
  };
};

/**
 * Configuração para limitar requisições mais agressivamente para rotas de autenticação
 * Útil para prevenir ataques de força bruta
 */
exports.authLimiter = exports.rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // limite mais restrito para tentativas de login
  message: 'Muitas tentativas de autenticação. Tente novamente mais tarde.'
});

/**
 * Configuração para limitar requisições para APIs públicas
 */
exports.apiLimiter = exports.rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 requisições por minuto
});

/**
 * Configuração específica para assinantes premium (limites mais altos)
 */
exports.premiumLimiter = exports.rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 120, // 120 requisições por minuto para usuários premium
  keyGenerator: (req) => {
    // Considerar o ID do usuário junto com IP para usuários autenticados
    const userId = req.user && req.user.id ? req.user.id : '';
    return userId ? `${userId}_${req.ip}` : req.ip;
  }
}); 