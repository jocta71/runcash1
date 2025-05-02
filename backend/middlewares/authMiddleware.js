/**
 * Middleware para autenticação e autorização
 * Utiliza JWT para validar tokens e gerenciar permissões
 */

const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const config = require('../config/config');
const { Usuario } = require('../models');
const getDb = require('../services/database');

// Configuração do JWT - deve ser obtida do arquivo de configuração
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Gera um token JWT para um usuário
 * 
 * @param {Object} user - Dados do usuário para incluir no token
 * @returns {String} Token JWT
 */
exports.gerarToken = (user) => {
  // Remover dados sensíveis do objeto de usuário
  const userData = {
    id: user.id,
    email: user.email,
    nome: user.nome,
    role: user.role || 'user',
    isPremium: user.isPremium || false
  };

  return jwt.sign(userData, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

/**
 * Middleware para proteger rotas - requer autenticação
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Função para passar para o próximo middleware
 */
exports.proteger = async (req, res, next) => {
  try {
    // Verificar se o token está presente
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Não autorizado - token não fornecido',
        error: 'ERROR_NO_TOKEN'
      });
    }
    
    // Verificar e decodificar o token
    const decodificado = jwt.verify(token, config.jwt.secret);
    
    // Buscar usuário para confirmar que ele existe e está ativo
    const usuario = await Usuario.findByPk(decodificado.id);
    
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou token inválido',
        error: 'ERROR_USER_NOT_FOUND'
      });
    }
    
    if (!usuario.ativo) {
      return res.status(403).json({
        success: false,
        message: 'Conta desativada. Entre em contato com o suporte.',
        error: 'ERROR_ACCOUNT_DISABLED'
      });
    }
    
    // Adicionar informações do usuário ao objeto da requisição
    req.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
      premium: usuario.premium,
      roles: usuario.roles || []
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado, faça login novamente',
        error: 'ERROR_TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: 'ERROR_INVALID_TOKEN'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro ao autenticar usuário',
      error: error.message
    });
  }
};

/**
 * Middleware para verificar se o usuário tem assinatura premium
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Função para passar para o próximo middleware
 */
exports.verificarPremium = (req, res, next) => {
  if (!req.usuario) {
    return res.status(500).json({
      success: false,
      message: 'Erro do sistema: usuário não autenticado',
      error: 'ERROR_NOT_AUTHENTICATED'
    });
  }
  
  if (!req.usuario.premium) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado: este recurso requer assinatura premium',
      error: 'ERROR_PREMIUM_REQUIRED'
    });
  }
  
  next();
};

/**
 * Middleware para restringir acesso baseado em roles/perfis
 * @param {...String} roles - Roles permitidos para acessar o recurso
 * @returns {Function} Middleware
 */
exports.restringirA = (...roles) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(500).json({
        success: false,
        message: 'Erro do sistema: usuário não autenticado',
        error: 'ERROR_NOT_AUTHENTICATED'
      });
    }
    
    // Verificar se o perfil do usuário está na lista de perfis permitidos
    if (!roles.includes(req.usuario.tipo) && 
        !req.usuario.roles.some(role => roles.includes(role))) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: você não tem permissão para acessar este recurso',
        error: 'ERROR_INSUFFICIENT_PERMISSIONS'
      });
    }
    
    next();
  };
};

/**
 * Middleware para verificar propriedade de um recurso
 * @param {Function} buscarRecurso - Função que busca o recurso pelo ID
 * @param {String} parametroId - Nome do parâmetro que contém o ID do recurso
 * @returns {Function} Middleware
 */
exports.verificarProprietario = (buscarRecurso, parametroId = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.usuario) {
        return res.status(500).json({
          success: false,
          message: 'Erro do sistema: usuário não autenticado',
          error: 'ERROR_NOT_AUTHENTICATED'
        });
      }
      
      const id = req.params[parametroId];
      const recurso = await buscarRecurso(id);
      
      if (!recurso) {
        return res.status(404).json({
          success: false,
          message: 'Recurso não encontrado',
          error: 'ERROR_RESOURCE_NOT_FOUND'
        });
      }
      
      // Se o usuário é admin, permitir acesso
      if (req.usuario.tipo === 'admin' || req.usuario.roles.includes('admin')) {
        return next();
      }
      
      // Verificar se o usuário é proprietário do recurso
      if (recurso.usuarioId !== req.usuario.id) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado: você não é o proprietário deste recurso',
          error: 'ERROR_NOT_RESOURCE_OWNER'
        });
      }
      
      // Adicionar o recurso à requisição para uso posterior
      req.recurso = recurso;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar propriedade do recurso',
        error: error.message
      });
    }
  };
};

/**
 * Middleware para limitar taxa de requisições
 * Implementação simples, para produção use redis ou similar
 * @param {Number} maxRequests - Número máximo de requisições permitidas
 * @param {Number} windowMs - Janela de tempo em millisegundos
 * @returns {Function} Middleware
 */
exports.limitarRequisicoes = (maxRequests = 100, windowMs = 60 * 1000) => {
  const requestCounts = {};
  const resetTimers = {};
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    // Inicializar contador para este IP
    if (!requestCounts[ip]) {
      requestCounts[ip] = 0;
      
      // Reiniciar contador após a janela de tempo
      resetTimers[ip] = setTimeout(() => {
        delete requestCounts[ip];
        delete resetTimers[ip];
      }, windowMs);
    }
    
    // Incrementar contador
    requestCounts[ip]++;
    
    // Verificar se excedeu o limite
    if (requestCounts[ip] > maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Muitas requisições, tente novamente mais tarde',
        error: 'ERROR_TOO_MANY_REQUESTS'
      });
    }
    
    next();
  };
};

/**
 * Middleware de autenticação
 * Verifica o token JWT e adiciona informações do usuário à requisição
 */
const verifyToken = async (req, res, next) => {
  try {
    // Obter token do cabeçalho Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      // Token não fornecido, continuar mas req.user será undefined
      console.log('[Auth] Token não fornecido, continuando como anônimo');
      return next();
    }
    
    try {
      // Verificar token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Buscar informações atualizadas do usuário no banco
      const db = await getDb();
      const user = await db.collection('users').findOne({ _id: decoded.id });
      
      if (!user) {
        console.warn(`[Auth] Usuário não encontrado para ID: ${decoded.id}`);
        return next();
      }
      
      // Adicionar informações do usuário à requisição
      req.user = {
        id: user._id.toString(),
        username: user.username || user.email,
        email: user.email,
        name: user.name,
        roles: user.roles || ['user'],
        asaasCustomerId: user.asaasCustomerId // ID do cliente no Asaas
      };
      
      console.log(`[Auth] Usuário autenticado: ${req.user.username}`);
      
      // Continuar com a requisição
      next();
    } catch (error) {
      // Token inválido, continuar sem req.user
      console.warn('[Auth] Token inválido:', error.message);
      next();
    }
  } catch (error) {
    console.error('[Auth] Erro ao verificar token:', error);
    // Em caso de erro, permitir requisição mas sem autenticação
    next();
  }
};

/**
 * Middleware para exigir autenticação
 * Retorna erro 401 se o usuário não estiver autenticado
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Autenticação necessária',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
};

/**
 * Middleware para verificar roles do usuário
 * @param {string[]} allowedRoles - Roles permitidos
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // Primeiro verificar se está autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Verificar se o usuário tem algum dos roles permitidos
    const hasAllowedRole = req.user.roles.some(role => allowedRoles.includes(role));
    
    if (!hasAllowedRole) {
      return res.status(403).json({
        success: false,
        message: 'Permissão negada',
        code: 'PERMISSION_DENIED'
      });
    }
    
    next();
  };
};

/**
 * Middleware para verificar permissões de administrador
 */
exports.requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Permissões de administrador necessárias'
    });
  }
  
  next();
};

module.exports = {
  verifyToken,
  requireAuth,
  checkRole
}; 