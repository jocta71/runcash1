/**
 * Middleware de autenticação
 * Responsável por validar tokens e proteger rotas
 */
const database = require('../services/database');
const jwt = require('jsonwebtoken');

// Segredo para validação dos tokens JWT
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

module.exports = {
  authenticate,
  requirePremium,
  requireAdmin
}; 