const express = require('express');
const router = express.Router();
const rouletteController = require('../controllers/rouletteController');
const { authenticateToken } = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionCheck');

// Rotas públicas - sem necessidade de autenticação
router.get('/public/providers', rouletteController.getRouletteProviders);

// Rotas que requerem apenas autenticação
router.get('/basic-info', authenticateToken, rouletteController.getBasicRouletteInfo);

// Rotas que requerem assinatura ativa
router.get('/', authenticateToken, requireActiveSubscription, rouletteController.getAllRoulettes);
router.get('/with-numbers', authenticateToken, requireActiveSubscription, rouletteController.getWithNumbers);
router.get('/detailed/:id', authenticateToken, requireActiveSubscription, rouletteController.getRouletteDetailed);
router.get('/historical/:id', authenticateToken, requireActiveSubscription, rouletteController.getRouletteHistorical);
router.get('/stats/:id', authenticateToken, requireActiveSubscription, rouletteController.getRouletteStats);

module.exports = router; 