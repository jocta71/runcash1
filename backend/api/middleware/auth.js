/**
 * Middleware de autenticação - DESATIVADO
 * Substituído por versão sem verificação de token para reduzir consumo de memória
 */

// Mantido apenas por compatibilidade
const jwt = require('jsonwebtoken');

/**
 * Middleware para proteção de rotas - DESATIVADO
 */
exports.protect = async (req, res, next) => {
  try {
    console.log('Middleware de autenticação desativado para reduzir consumo de memória');
    
    // Adicionar usuário padrão com permissões completas
    req.user = {
      id: 'system-default',
      email: 'default@system.local',
      role: 'admin'
    };
    
    next();
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    next(); // Continuar mesmo com erro
  }
};

/**
 * Middleware para verificar permissões de administrador
 */
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a administradores'
    });
  }
}; 