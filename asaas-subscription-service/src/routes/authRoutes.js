const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Rota para registro de usuário
router.post('/register', authController.register);

// Rota para login
router.post('/login', authController.login);

// Rota para obter dados do usuário atual (protegida)
router.get('/me', protect, authController.getMe);

module.exports = router; 