const jwt = require('jsonwebtoken');

/**
 * Middleware para proteção de rotas, requer autenticação via JWT
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    console.log('Headers de auth:', req.headers.authorization);
    console.log('Cookies disponíveis:', req.cookies);
    
    // Verificar se o token está presente no header de autorização
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Extrair o token do header
      token = req.headers.authorization.split(' ')[1];
      console.log('Token encontrado no header:', token ? token.substring(0, 15) + '...' : 'nenhum');
    } 
    // Ou usar o token dos cookies se disponível
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('Token encontrado no cookie:', token ? token.substring(0, 15) + '...' : 'nenhum');
    }

    // Se o token não estiver presente, retornar erro
    if (!token) {
      console.log('Nenhum token encontrado, acesso negado');
      return res.status(401).json({
        success: false,
        error: 'Não autorizado para acessar este recurso'
      });
    }

    try {
      // Verificar se o token é válido
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'runcash-default-secret');
      console.log('Token verificado com sucesso, usuário:', decoded.id);
      
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