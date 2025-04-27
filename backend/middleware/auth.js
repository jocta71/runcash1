const jwt = require('jsonwebtoken');

/**
 * Middleware para autenticação JWT
 * Verifica se o token é válido e adiciona informações do usuário à requisição
 */
exports.autenticar = (req, res, next) => {
  try {
    // Verificar se o token está presente no header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido',
        error: 'TOKEN_AUSENTE'
      });
    }
    
    // Verificar e decodificar o token JWT
    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'secret_padrao_roleta';
      const decodificado = jwt.verify(token, JWT_SECRET);
      
      // Adicionar informações do usuário à requisição
      req.usuario = {
        id: decodificado.id,
        email: decodificado.email,
        asaasCustomerId: decodificado.asaasCustomerId
      };
      
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expirado',
          error: 'TOKEN_EXPIRADO'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: 'TOKEN_INVALIDO'
      });
    }
  } catch (error) {
    console.error('Erro de autenticação:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno durante autenticação',
      error: 'ERRO_INTERNO'
    });
  }
}; 