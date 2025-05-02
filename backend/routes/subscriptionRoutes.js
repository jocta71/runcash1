/**
 * Rotas para gerenciamento de assinaturas
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { authenticate } = require('../middlewares/authMiddleware');
const { verificarPlano } = require('../middlewares/unifiedSubscriptionMiddleware');

// Outras rotas existentes...
// ... existing code ...

module.exports = router; 