const jwtUtils = require('../utils/jwt.utils');
const User = require('../models/user.model');
const ApiAccess = require('../models/apiAccess.model');

/**
 * Middleware para verificar autenticação via JWT
 */
exports.authenticate = async (req, res, next) => {
  try {
    // Extrair token do cabeçalho
    const token = jwtUtils.extractTokenFromHeader(req);
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Autenticação necessária' 
      });
    }
    
    // Verificar token
    const decoded = jwtUtils.verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido ou expirado' 
      });
    }
    
    // Buscar usuário no banco de dados
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não encontrado ou inativo' 
      });
    }
    
    // Anexar usuário à requisição
    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Erro de autenticação',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware para verificar se o usuário tem acesso a um endpoint específico
 * @param {String} endpoint - Endpoint da API principal que o usuário quer acessar
 * @param {String} method - Método HTTP (GET, POST, etc)
 */
exports.verifyApiAccess = (endpoint = '*', method = 'GET') => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;
      
      // Buscar as permissões de acesso do usuário
      const apiAccess = await ApiAccess.findOne({ userId });
      
      if (!apiAccess) {
        return res.status(403).json({
          success: false,
          message: 'Nenhum acesso à API encontrado para este usuário'
        });
      }
      
      // Verificar se o usuário tem acesso ao endpoint
      const hasAccess = apiAccess.canAccessEndpoint(endpoint, method);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado a este recurso. Assinatura ativa necessária.',
          subscriptionStatus: apiAccess.isActive ? 'Ativa' : 'Inativa',
          plan: apiAccess.plan
        });
      }
      
      // Incrementar contador de requisições
      await apiAccess.incrementRequestCount();
      
      // Adicionar dados de acesso à requisição
      req.apiAccess = apiAccess;
      next();
    } catch (error) {
      console.error('[API Access Middleware] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao verificar acesso à API',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * Middleware para verificar se o usuário é administrador
 */
exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso administrativo necessário'
    });
  }
  
  next();
}; 