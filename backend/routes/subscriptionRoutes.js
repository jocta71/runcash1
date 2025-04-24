/**
 * Rotas relacionadas a verificações de assinatura e permissões
 */

const express = require('express');
const router = express.Router();
const { proteger } = require('../middlewares/authMiddleware');
const subscriptionController = require('../controllers/subscriptionController');

// Rota para verificar acesso a um recurso específico
router.get('/check-access/:featureId', proteger, subscriptionController.checkFeatureAccess);

// Rota para listar todos os recursos disponíveis para o usuário
router.get('/available-features', proteger, subscriptionController.listAvailableFeatures);

module.exports = router; 