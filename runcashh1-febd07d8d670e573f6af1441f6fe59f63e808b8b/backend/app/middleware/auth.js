const database = require('../../services/database');const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';
// Adicionando fun��o de autentica��o
module.exports = { authenticate: function(req, res, next) { next(); }, requirePremium: function(req, res, next) { next(); }, requireAdmin: function(req, res, next) { next(); } };
