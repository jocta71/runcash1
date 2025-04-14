const express = require('express');
const router = express.Router();
const { 
  getStrategies, 
  getStrategy, 
  createStrategy, 
  updateStrategy, 
  deleteStrategy,
  assignStrategy,
  getRouletteStrategy
} = require('../controllers/strategyController');
const { protect } = require('../middleware/auth');

// Proteger todas as rotas
router.use(protect);

// Rotas de estratégias
router.route('/')
  .get(getStrategies)
  .post(createStrategy);

router.route('/:id')
  .get(getStrategy)
  .put(updateStrategy)
  .delete(deleteStrategy);

// Rota para associar estratégia a roleta
router.route('/assign')
  .post(assignStrategy);

// Rota para obter estratégia associada a uma roleta
router.route('/roulette/:roletaId')
  .get(getRouletteStrategy);

module.exports = router; 