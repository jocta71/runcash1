/**
 * Middleware simplificado para verificação de token
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Middleware para verificar token JWT
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 * @param {Function} next - Próximo middleware
 */
const verifyToken = (req, res, next) => {
  try {
    // Obter token do header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido ou formato inválido'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verificar token
    jwt.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) {
        console.error('[Auth] Erro ao verificar token:', err.message);
        
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Token expirado, faça login novamente'
          });
        }
        
        return res.status(401).json({
          success: false,
          message: 'Token inválido'
        });
      }
      
      // Adicionar usuário à requisição
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('[Auth] Erro ao processar token:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno na autenticação'
    });
  }
};

module.exports = { verifyToken }; 