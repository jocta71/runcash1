/**
 * Rotas públicas para dados de roletas criptografados
 * Não requer autenticação, mas os dados são criptografados com @hapi/iron
 */

const express = require('express');
const router = express.Router();
const publicRouletteController = require('../controllers/publicRouletteController');

// Middleware para registrar requisições
const logRequest = (req, res, next) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[PUBLIC-API ${requestId}] ${req.method} ${req.path} - IP: ${req.ip}`);
  req.requestId = requestId;
  next();
};

// Aplicar middleware de log em todas as rotas
router.use(logRequest);

/**
 * @route   GET /api/public/roulettes
 * @desc    Lista todas as roletas disponíveis com dados criptografados
 * @access  Público
 */
router.get('/roulettes', publicRouletteController.getPublicRoulettes);

/**
 * @route   GET /api/public/roulettes/:id
 * @desc    Obtém dados de uma roleta específica com dados criptografados
 * @access  Público
 */
router.get('/roulettes/:id', publicRouletteController.getPublicRouletteData);

/**
 * @route   GET /api/public/roulettes/realtime/latest
 * @desc    Obtém os últimos números de todas as roletas com dados criptografados
 * @access  Público
 */
router.get('/roulettes/realtime/latest', publicRouletteController.getPublicLatestNumbers);

module.exports = router; 