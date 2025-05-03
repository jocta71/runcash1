/**
 * Middleware simples para autenticação JWT
 * Este middleware verifica se o token JWT fornecido é válido
 */

const jwt = require("jsonwebtoken");

/**
 * Middleware para verificar token JWT
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.required - Se true, recusa requisições sem token
 * @param {Array} options.roles - Papéis permitidos para acessar a rota (opcional)
 * @returns {Function} Middleware de Express
 */
const authenticateToken = (options = { required: true }) => {
  return (req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[JWT-AUTH ${requestId}] Verificando token para ${req.method} ${req.path}`);
    
    // Extrair token do cabeçalho
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    // Se token não existir e for obrigatório
    if (!token) {
      if (options.required) {
        console.log(`[JWT-AUTH ${requestId}] Token não fornecido (obrigatório)`);
        return res.status(401).json({
          success: false,
          message: 'Token de autenticação obrigatório',
          code: 'TOKEN_REQUIRED',
          requestId
        });
      } else {
        console.log(`[JWT-AUTH ${requestId}] Token não fornecido (opcional)`);
        return next(); // Continuar sem token
      }
    }
    
    // Verificar token
    const secret = process.env.JWT_SECRET || 'runcashh_secret_key';
    
    try {
      const decoded = jwt.verify(token, secret);
      
      // Verificar se usuário possui role necessário (se especificado)
      if (options.roles && options.roles.length > 0) {
        const userRoles = decoded.roles || ['user'];
        const hasRequiredRole = userRoles.some(role => options.roles.includes(role));
        
        if (!hasRequiredRole) {
          console.log(`[JWT-AUTH ${requestId}] Usuário ${decoded.id} não possui role necessário`);
          return res.status(403).json({
            success: false,
            message: 'Acesso negado - Permissão insuficiente',
            code: 'INSUFFICIENT_ROLE',
            requestId
          });
        }
      }
      
      // Adicionar usuário decodificado à requisição
      req.user = decoded;
      console.log(`[JWT-AUTH ${requestId}] Token verificado para usuário ${decoded.id || 'desconhecido'}`);
      
      next();
    } catch (error) {
      console.error(`[JWT-AUTH ${requestId}] Erro ao verificar token:`, error.message);
      
      // Verificar tipo de erro
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expirado',
          code: 'TOKEN_EXPIRED',
          requestId
        });
      }
      
      return res.status(403).json({
        success: false,
        message: 'Token inválido',
        code: 'INVALID_TOKEN',
        error: error.message,
        requestId
      });
    }
  };
};

module.exports = { authenticateToken }; 