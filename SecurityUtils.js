/**
 * Classe utilitária com funções para verificações de segurança
 */
class SecurityUtils {
  /**
   * Lista de IPs bloqueados (em produção, isso estaria em um banco de dados)
   * @private
   */
  static #blockedIPs = new Set();

  /**
   * Verifica se um IP está bloqueado
   * @param {string} ip - Endereço IP para verificar
   * @returns {boolean} - True se o IP estiver bloqueado
   */
  static isBlockedIP(ip) {
    return this.#blockedIPs.has(ip);
  }

  /**
   * Sanitiza dados para prevenir XSS (Cross-Site Scripting)
   * @param {any} data - Dados para sanitizar
   * @returns {any} - Dados sanitizados
   */
  static sanitizeData(data) {
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    
    if (data && typeof data === 'object') {
      const sanitized = {};
      
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      
      return sanitized;
    }
    
    return data;
  }

  /**
   * Sanitiza uma string para prevenir XSS
   * @param {string} str - String para sanitizar
   * @returns {string} - String sanitizada
   */
  static sanitizeString(str) {
    if (typeof str !== 'string') {
      return str;
    }
    
    // Uso simplificado para exemplo
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .trim();
  }

  /**
   * Verifica se um ID do MongoDB é válido
   * @param {string} id - ID para verificar
   * @returns {boolean} - True se o ID for válido
   */
  static isValidMongoId(id) {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * Registra evento de segurança
   * @param {string} userId - ID do usuário relacionado ao evento
   * @param {string} resource - Recurso afetado
   * @param {Object} req - Objeto de requisição
   */
  static logSecurityEvent(userId, resource, req) {
    const eventData = {
      userId: userId || 'anônimo',
      resource,
      ip: req?.ip || req?.connection?.remoteAddress || 'desconhecido',
      userAgent: req?.headers?.['user-agent'] || 'desconhecido',
      timestamp: new Date().toISOString(),
      method: req?.method || 'N/A',
      path: req?.originalUrl || 'N/A'
    };
    
    console.warn(`Evento de segurança: Acesso a ${resource} por ${eventData.userId}`, eventData);
  }
}

module.exports = SecurityUtils; 