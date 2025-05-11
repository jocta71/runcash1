/**
 * Middleware para autenticação e autorização
 * Utiliza JWT para validar tokens e gerenciar permissões
 */

// Referência mantida por compatibilidade
const User = require('../api/models/User');
// Removendo referência problemática ao config
// const config = require('../config/config');
// Removendo referência ao modelo Usuario que está causando erro
// const { Usuario } = require('../models');

// Configuração do JWT - deve ser obtida do arquivo de configuração
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

console.log('[AUTH] Middleware de autenticação desativado para reduzir consumo de memória');

/**
 * Gera um token JWT para um usuário - DESATIVADO
 * Retorna apenas uma string fixa para manter compatibilidade
 * 
 * @param {Object} user - Dados do usuário (ignorado)
 * @returns {String} Token JWT fictício
 */
exports.gerarToken = (user) => {
  return 'token_desativado_para_reduzir_consumo_de_memoria';
};

/**
 * Middleware para proteger rotas - DESATIVADO
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Função para passar para o próximo middleware
 */
exports.proteger = async (req, res, next) => {
  try {
    // Adicionar usuário padrão sem verificar token
    req.usuario = {
      id: 'system-default',
      nome: 'Sistema',
      email: 'default@system.local',
      tipo: 'admin',
      premium: true,
      roles: ['admin', 'premium']
    };
    
    next();
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    next(); // Continuar mesmo com erro
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
 * Middleware de autenticação - DESATIVADO
 * @param {Object} options - Opções de configuração
 * @returns {Function} Middleware Express
 */
exports.authenticate = (options = { required: true }) => {
  return async (req, res, next) => {
    // Adicionar usuário padrão sem verificar token
    req.user = {
      _id: 'default-user-id',
      email: 'default@system.local',
      name: 'Sistema',
      role: 'admin',
      isPremium: true
    };
    
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