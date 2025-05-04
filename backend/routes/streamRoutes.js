/**
 * Rotas de streaming de dados em tempo real (SSE)
 * Implementa Server-Sent Events para enviar atualizações em tempo real
 */

const express = require('express');
const router = express.Router();
const streamController = require('../controllers/streamController');

/**
 * @route   GET /stream/rounds/ROULETTE/:id/v2/live
 * @desc    Streaming de dados em tempo real para uma roleta específica
 * @access  Público (com dados criptografados)
 */
router.get('/rounds/ROULETTE/:id/v2/live', streamController.streamRouletteData);

/**
 * @route   GET /stream/rounds/ROULETTE/:id/live
 * @desc    Versão alternativa do streaming (compatibilidade)
 * @access  Público (com dados criptografados)
 */
router.get('/rounds/ROULETTE/:id/live', streamController.streamRouletteData);

/**
 * @route   GET /stream/roulettes/:id
 * @desc    Versão simplificada do endpoint de streaming
 * @access  Público (com dados criptografados)
 */
router.get('/roulettes/:id', streamController.streamRouletteData);

module.exports = router; 