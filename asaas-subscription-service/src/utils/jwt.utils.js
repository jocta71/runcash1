const jwt = require('jsonwebtoken');

/**
 * Utilitários para trabalhar com JWT
 */
const jwtUtils = {
  /**
   * Gera um token JWT para o usuário
   * @param {Object} user - Objeto do usuário
   * @param {Object} accessData - Dados de acesso do usuário
   * @returns {String} Token JWT
   */
  generateToken(user, accessData = null) {
    // Dados que serão incluídos no token
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      externalId: user.externalId || null,
      
      // Dados da assinatura e acesso
      subscription: accessData ? {
        isActive: accessData.isActive,
        plan: accessData.plan,
        expiresAt: accessData.endDate ? accessData.endDate.toISOString() : null,
        permissions: accessData.endpoints.map(e => ({
          path: e.path,
          methods: e.methods,
          allowed: e.isAllowed
        }))
      } : null
    };
    
    // Gerar o token
    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );
  },
  
  /**
   * Verifica e decodifica um token JWT
   * @param {String} token - Token JWT para verificar
   * @returns {Object|null} Payload decodificado ou null se inválido
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  },
  
  /**
   * Extrai o token do cabeçalho de autorização
   * @param {Object} req - Objeto de requisição Express
   * @returns {String|null} Token extraído ou null
   */
  extractTokenFromHeader(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    return authHeader.split(' ')[1];
  }
};

module.exports = jwtUtils; 