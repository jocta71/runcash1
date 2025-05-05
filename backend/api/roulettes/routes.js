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

// Controladores da API unificada
const {
  getAllRoulettes,
  getCompactRoulettes,
  getConsolidatedRoulettes,
  getRouletteEvents,
  getAllInOneEvent
} = require('./unified_controller');

// Middleware da API unificada
const {
  verifyUnifiedClientKey,
  allowPublicAccess
} = require('./unified_middleware');

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

// ========= Novas rotas da API Unificada ==========

// Retorna todas as roletas com seus números
router.get('/all', 
  allowPublicAccess,
  verifyUnifiedClientKey,
  getAllRoulettes
);

// Retorna dados compactos das roletas
router.get('/compact', 
  allowPublicAccess,
  verifyUnifiedClientKey,
  getCompactRoulettes
);

// Retorna formato consolidado de todas as roletas
router.get('/consolidated', 
  allowPublicAccess,
  verifyUnifiedClientKey,
  getConsolidatedRoulettes
);

// Retorna roletas no formato de eventos (sem streaming)
router.get('/events', 
  allowPublicAccess,
  verifyUnifiedClientKey,
  getRouletteEvents
);

// Retorna todas as roletas em um único evento
router.get('/events/all-in-one', 
  allowPublicAccess,
  verifyUnifiedClientKey,
  getAllInOneEvent
);

module.exports = router; 