/**
 * Middleware para a API Unificada de Roletas
 * Responsável por verificar chaves de cliente e permissões
 */

const { verifyClientKey } = require('./utils/crypto');

/**
 * Middleware para verificar chave de cliente
 * Se não houver chave ou chave inválida, marca para criptografar dados
 * Se a chave for válida, permite acesso a dados descriptografados
 */
const verifyUnifiedClientKey = async (req, res, next) => {
  try {
    // Verificar se há uma chave na query string (parâmetro 'k')
    const clientKey = req.query.k;
    
    // Se não houver chave, marcar para criptografar dados
    if (!clientKey) {
      req.dadosCriptografados = true;
      return next();
    }
    
    // Verificar se a chave é válida
    const keyDetails = await verifyClientKey(clientKey);
    
    // Se a chave for inválida, retornar erro
    if (!keyDetails) {
      return res.status(401).json({
        error: 'Chave inválida',
        message: 'A chave fornecida não é válida ou expirou'
      });
    }
    
    // Armazenar detalhes da chave no request
    req.clientKey = keyDetails;
    
    // Se a chave for válida, não criptografar dados
    req.dadosCriptografados = false;
    
    // Continuar para o próximo middleware
    next();
  } catch (error) {
    console.error('Erro ao verificar chave de cliente:', error);
    
    // Por segurança, marcar para criptografar dados em caso de erro
    req.dadosCriptografados = true;
    next();
  }
};

/**
 * Middleware para permitir acesso apenas público a certas rotas
 * Usado para rotas que não precisam de autenticação
 */
const allowPublicAccess = (req, res, next) => {
  // Sempre permitir acesso, independente da autenticação
  next();
};

/**
 * Middleware para verificar se o usuário tem permissão específica
 * @param {string} permission - Permissão necessária
 */
const hasUnifiedPermission = (permission) => {
  return (req, res, next) => {
    // Se não houver informações de chave, não permitir
    if (!req.clientKey) {
      return res.status(403).json({
        error: 'Acesso negado',
        message: 'Você não tem permissão para acessar este recurso'
      });
    }
    
    // Verificar se a chave tem a permissão necessária
    if (!req.clientKey.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Acesso negado',
        message: `Permissão necessária: ${permission}`
      });
    }
    
    // Se tem permissão, continuar
    next();
  };
};

module.exports = {
  verifyUnifiedClientKey,
  allowPublicAccess,
  hasUnifiedPermission
}; 