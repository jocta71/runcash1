const jwt = require('jsonwebtoken');

/**
 * Middleware para proteção de rotas, requer autenticação via JWT
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Verificar se o token está presente no header de autorização
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Extrair o token do header
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // Ou usar o token dos cookies se disponível
      token = req.cookies.token;
    }

    // Se o token não estiver presente, retornar erro
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado para acessar este recurso'
      });
    }

    // Verificar o token (simplificado para teste)
    try {
      // Verificar se o token é válido
      // Nota: Em produção, usar uma chave secreta e configuração adequada
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'runcash-default-secret');
      
      // Adicionar o usuário decodificado ao objeto de requisição
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || 'user'
      };
      
      next();
    } catch (error) {
      console.error('Erro ao verificar token:', error);
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado'
      });
    }
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro no servidor durante autenticação'
    });
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