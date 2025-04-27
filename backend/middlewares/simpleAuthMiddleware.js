/**
 * Middleware para autenticação simplificada
 * Versão para testes/desenvolvimento que não requer banco de dados
 */

const jwt = require('jsonwebtoken');

// Configuração do JWT
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Gera um token JWT para um usuário
 * 
 * @param {Object} user - Dados do usuário para incluir no token
 * @returns {String} Token JWT
 */
exports.gerarToken = (user) => {
  // Remover dados sensíveis do objeto de usuário
  const userData = {
    id: user.id,
    email: user.email,
    nome: user.nome,
    role: user.role || 'user',
    isPremium: user.isPremium || false,
    asaasCustomerId: user.asaasCustomerId || null
  };

  return jwt.sign(userData, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

/**
 * Middleware para proteger rotas - versão simplificada sem validação de banco
 */
exports.proteger = (req, res, next) => {
  try {
    // Verificar se o token está presente
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('[Auth] Token não fornecido');
      
      // Modo de desenvolvimento - usuário fictício
      if (process.env.NODE_ENV === 'development' || process.env.ALLOW_PUBLIC_ACCESS === 'true') {
        console.log('[Auth] Modo de desenvolvimento - permitindo acesso anônimo');
        req.usuario = {
          id: 'anonymous_user',
          nome: 'Usuário Anônimo',
          email: 'anonymous@example.com',
          tipo: 'user',
          premium: true
        };
        return next();
      }
      
      return res.status(401).json({
        success: false,
        message: 'Não autorizado - token não fornecido',
        error: 'ERROR_NO_TOKEN'
      });
    }
    
    // Verificar e decodificar o token
    let decodificado;
    try {
      decodificado = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.log('[Auth] Erro ao validar token:', err.message);
      
      // No modo de desenvolvimento, permitir acesso mesmo com token inválido
      if (process.env.NODE_ENV === 'development' || process.env.ALLOW_PUBLIC_ACCESS === 'true') {
        console.log('[Auth] Modo de desenvolvimento - permitindo acesso mesmo com token inválido');
        req.usuario = {
          id: 'anonymous_user',
          nome: 'Usuário Anônimo',
          email: 'anonymous@example.com',
          tipo: 'user',
          premium: true
        };
        return next();
      }
      
      // Erro de token expirado
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expirado, faça login novamente',
          error: 'ERROR_TOKEN_EXPIRED'
        });
      }
      
      // Erro de token inválido
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: 'ERROR_INVALID_TOKEN'
      });
    }
    
    // Adicionar informações do usuário ao objeto da requisição
    req.usuario = {
      id: decodificado.id,
      nome: decodificado.nome,
      email: decodificado.email,
      tipo: decodificado.role || 'user',
      premium: decodificado.isPremium || false,
      roles: decodificado.roles || [],
      asaasCustomerId: decodificado.asaasCustomerId || null
    };
    
    // Duplicar para compatibilidade
    req.user = req.usuario;
    
    next();
  } catch (error) {
    console.error('[Auth] Erro não tratado:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao autenticar usuário',
      error: error.message
    });
  }
};

/**
 * Middleware simplificado de autenticação que permite configurar se é obrigatório
 */
exports.authenticate = (options = { required: true }) => {
  return (req, res, next) => {
    try {
      // Verificar se o token está presente
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Se autenticação é opcional, continuar sem usuário
        if (!options.required) {
          console.log('[Auth] Autenticação opcional - continuando sem usuário');
          req.user = null;
          req.usuario = null;
          return next();
        }
        
        // Se estamos em modo de desenvolvimento, permitir acesso anônimo
        if (process.env.NODE_ENV === 'development' || process.env.ALLOW_PUBLIC_ACCESS === 'true') {
          console.log('[Auth] Modo de desenvolvimento - permitindo acesso anônimo');
          req.user = {
            id: 'anonymous_user',
            nome: 'Usuário Anônimo',
            email: 'anonymous@example.com',
            role: 'user',
            isPremium: true
          };
          req.usuario = req.user;
          return next();
        }
        
        // Se é obrigatório, retornar erro
        return res.status(401).json({
          success: false,
          message: 'Acesso negado. Autenticação necessária'
        });
      }
      
      // Extrai token do header
      const token = authHeader.split(' ')[1];
      
      // Verifica e decodifica o token
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        req.user = {
          id: decoded.id,
          nome: decoded.nome,
          email: decoded.email,
          role: decoded.role || 'user',
          isPremium: decoded.isPremium || false,
          asaasCustomerId: decoded.asaasCustomerId || null
        };
        
        // Duplicar para compatibilidade
        req.usuario = req.user;
        
        next();
      } catch (error) {
        // Se a autenticação é opcional, continuar sem usuário
        if (!options.required) {
          req.user = null;
          req.usuario = null;
          return next();
        }
        
        // Se estamos em modo de desenvolvimento, permitir acesso anônimo
        if (process.env.NODE_ENV === 'development' || process.env.ALLOW_PUBLIC_ACCESS === 'true') {
          console.log('[Auth] Modo de desenvolvimento - permitindo acesso anônimo após erro de token');
          req.user = {
            id: 'anonymous_user',
            nome: 'Usuário Anônimo',
            email: 'anonymous@example.com',
            role: 'user',
            isPremium: true
          };
          req.usuario = req.user;
          return next();
        }
        
        return res.status(401).json({
          success: false,
          message: 'Token inválido ou expirado'
        });
      }
    } catch (error) {
      console.error('[Auth] Erro não tratado:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno no servidor durante autenticação'
      });
    }
  };
}; 