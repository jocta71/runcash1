const express = require('express');
const router = express.Router();

// Importar middlewares de autenticação e verificação de assinatura
const { protect } = require('../middleware/auth');
const subscriptionCheck = require('../middleware/subscription-check');

// Importar controladores
const strategyController = require('../controllers/strategyController');
const rouletteSearchController = require('../controllers/rouletteSearchController');
const historyController = require('../controllers/historyController');

// Rotas públicas (não requerem autenticação)
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== Rotas protegidas (requerem autenticação) =====
router.use('/api', protect);

// ===== Rotas básicas (requerem apenas autenticação) =====
// Perfil do usuário
router.get('/api/profile', (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

// Detalhes da assinatura (informações básicas)
router.get('/api/subscription/details', subscriptionCheck.addSubscriptionInfo, (req, res) => {
  res.status(200).json({ 
    success: true, 
    subscriptionInfo: req.subscriptionStatus || { active: false, status: 'none' }
  });
});

// ===== Rotas que requerem assinatura ativa =====
// Middleware para verificar assinatura ativa
const premiumRouter = express.Router();
premiumRouter.use(subscriptionCheck.requireActiveSubscription);

// Estratégias (acesso premium)
premiumRouter.get('/strategies', strategyController.getStrategies);
premiumRouter.get('/strategy/:id', strategyController.getStrategy);
premiumRouter.post('/strategy', strategyController.createStrategy);
premiumRouter.put('/strategy/:id', strategyController.updateStrategy);
premiumRouter.delete('/strategy/:id', strategyController.deleteStrategy);

// Histórico detalhado (acesso premium)
premiumRouter.get('/history/detailed', historyController.getDetailedHistory);
premiumRouter.get('/history/analysis', historyController.getAnalysis);

// Busca de roletas (acesso premium)
premiumRouter.get('/roulette/search', rouletteSearchController.searchRoulettes);

// Adicionar rotas premium às rotas principais
router.use('/api/premium', premiumRouter);

// ===== Rotas que aceitam assinatura ativa ou pendente =====
const flexibleRouter = express.Router();
flexibleRouter.use(subscriptionCheck.allowPendingSubscription);

// Funcionalidades básicas que aceitam pagamento pendente
flexibleRouter.get('/basic-strategy', strategyController.getBasicStrategy);
flexibleRouter.get('/history/basic', historyController.getBasicHistory);

// Adicionar rotas flexíveis às rotas principais
router.use('/api/flexible', flexibleRouter);

module.exports = router; 