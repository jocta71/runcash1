/**
 * Módulo de logger simplificado
 * Este módulo fornece funções básicas de log compatíveis com o módulo original
 */

const logger = {
  info: function(message, data = {}) {
    console.log(`[INFO] ${message}`, data);
  },
  
  warn: function(message, data = {}) {
    console.warn(`[WARN] ${message}`, data);
  },
  
  error: function(message, data = {}) {
    console.error(`[ERROR] ${message}`, data);
    if (data.stack) {
      console.error(data.stack);
    }
  },
  
  debug: function(message, data = {}) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] ${message}`, data);
    }
  }
};

module.exports = logger; 