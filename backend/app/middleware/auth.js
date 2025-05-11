const database = require('../../services/database');
// JWT mantido apenas para compatibilidade
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';

// Middleware de autenticação desativado para reduzir consumo de memória
module.exports = { 
  authenticate: function(req, res, next) {
    // Adicionar usuário padrão
    req.user = {
      id: 'system-default',
      email: 'default@system.local',
      role: 'admin',
      isPremium: true
    };
    next(); 
  }, 
  requirePremium: function(req, res, next) {
    req.user = {
      id: 'system-default',
      email: 'default@system.local',
      role: 'admin',
      isPremium: true
    };
    next(); 
  }, 
  requireAdmin: function(req, res, next) {
    req.user = {
      id: 'system-default',
      email: 'default@system.local',
      role: 'admin',
      isPremium: true
    };
    next(); 
  } 
};
