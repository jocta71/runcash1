const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const SecurityUtils = require('../utils/SecurityUtils');

/**
 * Middleware para proteger rotas, verificando o token JWT
 * @returns {Function} Middleware Express
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Verificar se existe token no header Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Extrair o token do header
      token = req.headers.authorization.split(' ')[1];

      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verificar se o usuário existe
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        res.status(401);
        throw new Error('Acesso não autorizado - usuário não encontrado');
      }

      // Verificar se o usuário está bloqueado
      if (user.isBlocked) {
        res.status(403);
        throw new Error('Conta bloqueada. Entre em contato com o suporte');
      }

      // Verificar último login e forçar reautenticação após 24h
      const tokenIat = new Date(decoded.iat * 1000);  // iat é em segundos, converter para ms
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      if (tokenIat < twentyFourHoursAgo) {
        res.status(401);
        throw new Error('Token expirado. Faça login novamente');
      }

      // Verificar IP de origem
      if (SecurityUtils.isBlockedIP(req.ip)) {
        res.status(403);
        throw new Error('Acesso bloqueado para este IP');
      }

      // Adicionar usuário ao objeto da requisição
      req.user = user;

      next();
    } catch (error) {
      res.status(401);
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Token inválido');
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Token expirado');
      } else {
        throw new Error(error.message || 'Não autorizado');
      }
    }
  } else {
    res.status(401);
    throw new Error('Acesso não autorizado - token não fornecido');
  }
});

/**
 * Middleware para verificar a permissão do usuário
 * @param  {...String} roles - Lista de papéis permitidos
 * @returns {Function} Middleware Express
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Verificar se existe usuário autenticado
    if (!req.user) {
      res.status(401);
      throw new Error('Acesso não autorizado');
    }

    // Verificar se o usuário tem a permissão necessária
    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error('Você não tem permissão para acessar este recurso');
    }

    next();
  };
};

/**
 * Middleware para autenticação opcional
 * @returns {Function} Middleware Express
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  // Verificar se existe token no header Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && !user.isBlocked) {
        req.user = user;
      }
    } catch (error) {
      // Não lança erro, apenas continua sem usuário autenticado
      console.warn('Token opcional inválido:', error.message);
    }
  }

  // Sanitizar dados de entrada
  req.body = SecurityUtils.sanitizeData(req.body);
  req.query = SecurityUtils.sanitizeData(req.query);
  req.params = SecurityUtils.sanitizeData(req.params);

  next();
});

/**
 * Middleware para registrar acessos
 * @returns {Function} Middleware Express
 */
const accessLogger = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  
  // Capturar o status code após a conclusão da requisição
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const userId = req.user ? req.user._id : 'anônimo';
    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'desconhecido';
    
    // Log de acesso
    console.log(`ACESSO [${new Date().toISOString()}] ${method} ${url} ${status} ${duration}ms | Usuário: ${userId} | IP: ${ip} | User-Agent: ${userAgent}`);
    
    // Aqui poderia ser implementado um registro de log em banco de dados
    // ou serviço de monitoramento como:
    // await AccessLog.create({...})
  });
  
  next();
});

module.exports = {
  protect,
  authorize,
  optionalAuth,
  accessLogger
}; 