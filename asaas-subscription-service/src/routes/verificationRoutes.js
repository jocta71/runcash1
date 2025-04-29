const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');

// Rota para verificar se um usuário tem assinatura ativa
router.get('/subscription/:userId', verificationController.verifySubscription);

// Rota para verificar se um token JWT tem informações válidas de assinatura
router.post('/token', verificationController.verifyToken);

module.exports = router; 