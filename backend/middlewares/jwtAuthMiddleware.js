/**
 * Middleware JWT desativado para reduzir consumo de memória
 * Este middleware foi modificado para não realizar verificação de tokens
 */

// Constante mantida apenas para compatibilidade com código existente
const JWT_SECRET = process.env.JWT_SECRET || 'runcashh_secret_key';

// Log informativo
console.log(`[JWT] Middleware desativado para reduzir consumo de memória`);

/**
 * Middleware para verificar token JWT - DESATIVADO
 * @param {Object} options - Opções de configuração (ignoradas)
 * @returns {Function} Middleware de Express
 */
const authenticateToken = (options = { required: true }) => {
  return (req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[JWT-AUTH ${requestId}] Verificação JWT desativada para ${req.method} ${req.path}`);
    
    // Adicionar usuário padrão com permissões básicas
    req.user = {
      id: 'system-default',
      email: 'default@system.local',
      nome: 'Sistema',
      role: 'user',
      isPremium: true,
      roles: ['user', 'premium']
    };
    
    // Continuar sem verificar token
    next();
  };
};

module.exports = {
  authenticateToken,
  JWT_SECRET
}; 