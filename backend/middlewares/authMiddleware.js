/**
 * Middleware para autenticação e autorização
 * Utiliza JWT para validar tokens e gerenciar permissões
 */

const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const config = require('../config/config');
const { Usuario } = require('../models');

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
 * @param {Object} options - Opções de configuração
 * @param {Boolean} options.required - Se true, bloqueia acesso sem autenticação
 * @returns {Function} Middleware Express
 */
exports.authenticate = (options = { required: true }) => {
  return async (req, res, next) => {
    try {
      // Verificar se há token no header de autorização
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Se autenticação é obrigatória, retorna erro
        if (options.required) {
          return res.status(401).json({
            success: false,
            message: 'Acesso negado. Autenticação necessária'
          });
        }
        
        // Se não é obrigatória, continua sem usuário autenticado
        req.user = null;
        return next();
      }
      
      // Extrai token do header
      const token = authHeader.split(' ')[1];
      
      // Verifica e decodifica o token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Busca usuário no banco de dados
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        if (options.required) {
          return res.status(401).json({
            success: false,
            message: 'Token inválido ou usuário não encontrado'
          });
        }
        
        req.user = null;
        return next();
      }
      
      // Adiciona informações do usuário ao request
      req.user = user;
      next();
      
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        if (options.required) {
          return res.status(401).json({
            success: false,
            message: 'Token inválido ou expirado'
          });
        }
        
        req.user = null;
        return next();
      }
      
      console.error('Erro de autenticação:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno no servidor durante autenticação'
      });
    }
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