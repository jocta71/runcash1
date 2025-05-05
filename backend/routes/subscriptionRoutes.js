/**
 * Rotas para gerenciamento de assinaturas
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

// Importar middlewares
const { authenticate } = require('../middlewares/authMiddleware');
const { verificarPlano } = require('../middlewares/unifiedSubscriptionMiddleware');
const { checkSubscription } = require('../middleware/subscriptionCheck');
const { generateAccessKey } = require('../utils/cryptoUtils');

// Outras rotas existentes...
// ... existing code ...

/**
 * @route   GET /api/subscription/status
 * @desc    Verifica o status da assinatura do usuário
 * @access  Privado - Requer autenticação
 */
router.get('/status', subscriptionController.getSubscriptionStatus);

/**
 * @route   GET /api/subscription/access-key
 * @desc    Obtém uma chave de acesso para descriptografia de dados da API
 * @access  Privado - Requer assinatura ativa
 */
router.get('/access-key', subscriptionController.generateAccessKey);

/**
 * @route   DELETE /api/subscription/access-key
 * @desc    Revoga uma chave de acesso
 * @access  Privado - Requer autenticação
 */
router.delete('/access-key', subscriptionController.revokeAccessKey);

module.exports = router; 