const { verifyClientKey } = require('./utils/crypto');

/**
 * Middleware para verificar se o usuário está autenticado
 * Verifica o token JWT e adiciona o usuário ao objeto de requisição
 */
const isAuthenticated = (req, res, next) => {
  try {
    // Verifica o token de autenticação (usando sistema de autenticação existente)
    // Supondo que você já tem um middleware de autenticação em outro lugar
    
    // Se não estiver autenticado, permite acesso apenas ao stream criptografado
    if (!req.user && req.path.includes('/stream/')) {
      req.isPublicAccess = true;
      return next();
    }
    
    // Se não estiver autenticado e não for rota de stream, retorna erro
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Não autorizado',
        message: 'Você precisa estar autenticado para acessar este recurso' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    return res.status(500).json({ 
      error: 'Erro de servidor',
      message: 'Ocorreu um erro durante a autenticação' 
    });
  }
};

/**
 * Middleware para verificar a chave do cliente para decodificação
 * A chave é enviada como parâmetro de query 'k'
 */
const verifyClientKeyMiddleware = async (req, res, next) => {
  try {
    // Se for acesso público sem autenticação, permite acesso apenas ao stream criptografado
    if (req.isPublicAccess && req.path.includes('/stream/')) {
      return next();
    }
    
    // Obtém a chave do cliente da query
    const clientKey = req.query.k;
    
    if (!clientKey) {
      return res.status(400).json({ 
        error: 'Parâmetro ausente',
        message: 'A chave de cliente é obrigatória' 
      });
    }
    
    // Verifica se a chave é válida
    const keyData = await verifyClientKey(clientKey);
    
    if (!keyData) {
      return res.status(403).json({ 
        error: 'Chave inválida',
        message: 'A chave de cliente fornecida é inválida ou expirou' 
      });
    }
    
    // Adiciona os dados da chave ao objeto de requisição
    req.clientKey = keyData;
    
    next();
  } catch (error) {
    console.error('Erro ao verificar chave do cliente:', error);
    return res.status(500).json({ 
      error: 'Erro de servidor',
      message: 'Ocorreu um erro ao processar a chave do cliente' 
    });
  }
};

/**
 * Middleware para verificar permissões específicas
 * @param {string} permission - Permissão necessária
 */
const hasPermission = (permission) => {
  return (req, res, next) => {
    // Se for acesso público, verifica se é apenas para stream
    if (req.isPublicAccess && req.path.includes('/stream/')) {
      return next();
    }
    
    // Verifica se o usuário tem a chave do cliente
    if (!req.clientKey) {
      return res.status(403).json({ 
        error: 'Não autorizado',
        message: 'Chave de cliente não fornecida' 
      });
    }
    
    // Verifica se o usuário tem a permissão necessária
    if (!req.clientKey.permissions.includes(permission)) {
      return res.status(403).json({ 
        error: 'Permissão negada',
        message: `Você não tem permissão para ${permission}` 
      });
    }
    
    next();
  };
};

module.exports = {
  isAuthenticated,
  verifyClientKeyMiddleware,
  hasPermission
}; 