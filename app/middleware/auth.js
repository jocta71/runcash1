const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const SecurityUtils = require('../utils/SecurityUtils');
const database = require('../../services/database');

/**
 * Middleware de autenticação
 * Responsável por validar tokens e proteger rotas
 */
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';

/**
 * Middleware para proteger rotas
 * Verifica se o token é válido e carrega os dados do usuário
 */
const authenticate = async (req, res, next) => {
  try {
    // Verificar se há token no header de autorização
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado. Token não fornecido.',
        error: 'UNAUTHORIZED'
      });
    }
    
    // Extrair token
    const token = authHeader.split(' ')[1];
    
    // Verificar e decodificar token
    const decodificado = jwt.verify(token, JWT_SECRET);
    
    // Buscar usuário no banco de dados
    const usuario = await database.findUserByIdOrEmail(decodificado.id || decodificado.userId);
    
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou token inválido',
        error: 'USER_NOT_FOUND'
      });
    }
    
    // Verificar se o usuário está ativo (se aplicável)
    if (usuario.ativo === false) {
      return res.status(403).json({
        success: false,
        message: 'Conta desativada. Entre em contato com o suporte.',
        error: 'ACCOUNT_DISABLED'
      });
    }
    
    // Adicionar informações do usuário à requisição
    req.usuario = {
      id: usuario._id || usuario.id,
      nome: usuario.nome || usuario.username,
      email: usuario.email,
      tipo: usuario.tipo || usuario.role || 'user',
      premium: usuario.premium || usuario.isPremium || false,
      roles: usuario.roles || []
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado, faça login novamente',
        error: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: 'INVALID_TOKEN'
      });
    }
    
    console.error('[Auth] Erro de autenticação:', error);
    
    res.status(500).json({
      success: false,
      message: 'Erro ao autenticar usuário',
      error: 'SERVER_ERROR'
    });
  }
};

/**
 * Middleware para verificar permissões premium
 */
const requirePremium = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado',
      error: 'UNAUTHORIZED'
    });
  }
  
  if (!req.usuario.premium) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Este recurso requer assinatura premium.',
      error: 'PREMIUM_REQUIRED'
    });
  }
  
  next();
};

/**
 * Middleware para verificar permissões de administrador
 */
const requireAdmin = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado',
      error: 'UNAUTHORIZED'
    });
  }
  
  const isAdmin = 
    req.usuario.tipo === 'admin' || 
    req.usuario.roles.includes('admin');
  
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Este recurso requer permissões de administrador.',
      error: 'ADMIN_REQUIRED'
    });
  }
  
  next();
};

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
  accessLogger,
  authenticate,
  requirePremium,
  requireAdmin
}; 