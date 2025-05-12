const database = require('../../services/database');
// JWT mantido apenas para compatibilidade
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';

// Middleware de autenticação desativado para reduzir consumo de memória
module.exports = { 
  authenticate: function(req, res, next) {
    // Verificar se há token no header de autorização
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acesso negado. Autenticação necessária'
      });
    }
    
    try {
      // Extrair token do header
      const token = authHeader.split(' ')[1];
      
      // Verificar e decodificar o token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Adicionar usuário à requisição
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
    }
  }, 
  
  requirePremium: function(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária'
      });
    }
    
    if (!req.user.isPremium) {
      return res.status(403).json({
        success: false,
        message: 'Requer assinatura premium'
      });
    }
    
    next();
  }, 
  
  requireAdmin: function(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária'
      });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso restrito a administradores'
      });
    }
    
    next();
  } 
};
