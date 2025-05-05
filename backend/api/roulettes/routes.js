const express = require('express');
const router = express.Router();

const {
  streamRouletteUpdates,
  generateClientKeyController,
  submitRouletteResult,
  getRouletteHistory,
  simulateRandomResult
} = require('./controller');

const {
  isAuthenticated,
  verifyClientKeyMiddleware,
  hasPermission
} = require('./middleware');

// Configurar middleware global para verificar autenticação
router.use(isAuthenticated);

// Endpoint público para streaming de dados criptografados
// Nota: O middleware permitirá acesso não autenticado a esta rota específica
router.get('/stream/rounds/ROULETTE/:tableId/v2/live', streamRouletteUpdates);

// Rotas que requerem autenticação e verificação de chave

// Gerar chave de cliente para um usuário autenticado
router.post('/keys/generate', generateClientKeyController);

// Obter histórico de resultados (requer chave de cliente)
router.get('/history/:tableId', 
  verifyClientKeyMiddleware,
  hasPermission('view_roulette'),
  getRouletteHistory
);

// Submeter manualmente um resultado da roleta (apenas para administradores)
router.post('/result/:tableId', 
  verifyClientKeyMiddleware,
  hasPermission('admin_roulette'),
  submitRouletteResult
);

// Simular um resultado aleatório (apenas para administradores e desenvolvimento)
router.post('/simulate/:tableId', 
  verifyClientKeyMiddleware,
  hasPermission('admin_roulette'),
  simulateRandomResult
);

module.exports = router; 