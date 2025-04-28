/**
 * Rotas para gerenciamento de assinaturas
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { authenticate } = require('../middlewares/authMiddleware');
const { verificarPlano } = require('../middlewares/unifiedSubscriptionMiddleware');
const subscriptionVerifier = require('../middlewares/subscriptionVerifier');

// Rotas para verificação de assinatura
/**
 * @route   GET /api/subscription/status
 * @desc    Verifica e retorna o status da assinatura do usuário
 * @access  Público / Autenticação Opcional
 */
router.get('/status', 
  authenticate({ required: false }),
  subscriptionVerifier.getSubscriptionStatus
);

// Outras rotas existentes...
// ... existing code ...

module.exports = router; 