class SecurityUtils {
  static isBlockedIP(ip) {
    return false;
  }
  
  static sanitizeData(data) {
    return data;
  }
  
  static isValidMongoId(id) {
    return true;
  }
  
  static logSecurityEvent(userId, resource, req) {
    console.log(`Evento de segurança: ${userId} em ${resource}`);
  }
}

module.exports = SecurityUtils; 