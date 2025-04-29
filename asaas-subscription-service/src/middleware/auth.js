const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  
  // Verificar se o token está nos headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // Verificar se o token existe
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Acesso não autorizado. Faça login para continuar.'
    });
  }
  
  try {
    // Verificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar o usuário pelo ID no token
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }
    
    // Verificar se o usuário está ativo
    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'Sua conta está desativada. Entre em contato com o suporte.'
      });
    }
    
    // Adicionar o usuário ao objeto da requisição
    req.user = user;
    next();
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    return res.status(401).json({
      success: false,
      message: 'Token inválido ou expirado. Faça login novamente.'
    });
  }
};

// Middleware para autorização baseada em roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado. Faça login para continuar.'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para acessar este recurso.'
      });
    }
    
    next();
  };
};

module.exports = {
  protect,
  authorize
}; 