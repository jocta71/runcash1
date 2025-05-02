/**
 * Rotas relacionadas a assinaturas
 */

const express = require('express');
const router = express.Router();
const { proteger } = require('../middlewares/authMiddleware');
const assinaturaController = require('../controllers/assinaturaController');

// Rotas públicas (não requerem autenticação)
router.get('/planos', assinaturaController.listarPlanos);

// Rotas que requerem autenticação
router.get('/status', proteger, assinaturaController.obterStatus);
router.post('/processar', proteger, assinaturaController.processarAssinatura);
router.post('/cancelar', proteger, assinaturaController.cancelarAssinatura);

module.exports = router; 