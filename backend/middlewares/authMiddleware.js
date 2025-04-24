/**
 * Middleware para autenticação e autorização
 * Utiliza JWT para validar tokens e gerenciar permissões
 */

const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

// Configuração do JWT - deve ser obtida do arquivo de configuração
const JWT_SECRET = process.env.JWT_SECRET || 'runcash2024secretkey';
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
    let token;

    // Verificar se o token está presente no header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // Verificar se o token está presente nos cookies
      token = req.cookies.token;
    } else if (req.query && req.query.token) {
      // Verificar se o token está presente na query string
      token = req.query.token;
    }

    // Se não houver token, retornar erro
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Acesso negado. É necessário autenticação para acessar este recurso',
        code: 'NO_TOKEN'
      });
    }

    // Verificar o token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Buscar usuário no banco de dados
    const db = await getDb();
    
    // Tentar encontrar no formato com mongoose
    let usuario = await db.collection('usuarios').findOne({
      _id: ObjectId.isValid(decoded.id) ? new ObjectId(decoded.id) : decoded.id
    });

    // Se não encontrar, tentar no formato novo
    if (!usuario) {
      usuario = await db.collection('users').findOne({
        id: decoded.id
      });
    }

    // Se ainda não encontrar, retornar erro
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'O usuário associado a este token não existe mais',
        code: 'USER_NOT_FOUND'
      });
    }

    // Adicionar usuário ao objeto de requisição
    req.usuario = usuario;
    req.user = {
      id: usuario._id || usuario.id,
      email: usuario.email,
      nome: usuario.nome || usuario.name,
      asaasCustomerId: usuario.asaasCustomerId || usuario.customerAsaasId
    };

    next();
  } catch (error) {
    console.error('Erro na autenticação:', error);
    
    // Se o erro for de token expirado
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Sessão expirada. Por favor, faça login novamente',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Se o erro for de token inválido
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido. Por favor, faça login novamente',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Erro na autenticação',
      error: error.message,
      code: 'AUTH_ERROR'
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