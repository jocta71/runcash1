/**
 * Rotas para gerenciamento de estratégias
 */
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

// Rota para listar todas as estratégias (requer autenticação)
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Lista de estratégias recuperada com sucesso',
      data: [
        {
          id: '1',
          nome: 'Estratégia Básica',
          descricao: 'Estratégia para iniciantes'
        },
        {
          id: '2',
          nome: 'Estratégia Avançada',
          descricao: 'Estratégia para usuários avançados',
          premium: true
        }
      ]
    });
  } catch (error) {
    console.error('[Strategies] Erro ao listar estratégias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estratégias',
      error: error.message
    });
  }
});

// Rota para obter estratégia específica (requer autenticação)
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // Simular busca no banco de dados
    if (id === '1') {
      return res.json({
        success: true,
        data: {
          id: '1',
          nome: 'Estratégia Básica',
          descricao: 'Estratégia para iniciantes',
          regras: [
            'Aguarde 3 repetições',
            'Aposte no número oposto'
          ]
        }
      });
    } else if (id === '2') {
      return res.json({
        success: true,
        data: {
          id: '2',
          nome: 'Estratégia Avançada',
          descricao: 'Estratégia para usuários avançados',
          premium: true,
          regras: [
            'Analise os últimos 50 números',
            'Identifique padrões de repetição',
            'Aposte nos números mais prováveis'
          ]
        }
      });
    }
    
    res.status(404).json({
      success: false,
      message: 'Estratégia não encontrada',
      error: 'NOT_FOUND'
    });
  } catch (error) {
    console.error('[Strategies] Erro ao buscar estratégia:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estratégia',
      error: error.message
    });
  }
});

module.exports = router; 