/**
 * Rotas para funcionalidades premium
 */

const express = require('express');
const router = express.Router();
const { proteger, verificarPremium } = require('../middlewares/authMiddleware');
const subscriptionMiddleware = require('../middlewares/unifiedSubscriptionMiddleware');
const premiumController = require('../controllers/premiumController');
const { requireSubscription } = require('../middlewares/subscriptionMiddleware');

// Aplicar middleware de autenticação em todas as rotas
router.use(proteger);

// Aplicar middleware para verificar plano premium
router.use(subscriptionMiddleware.verificarPlano(['premium', 'empresarial']));

// Rotas de relatórios financeiros
router.get('/relatorios', premiumController.obterRelatoriosFinanceiros);

// Rotas de exportação de dados
router.post('/exportar', premiumController.exportarDados);

// Rotas de análise de tendências
router.post('/tendencias', premiumController.analisarTendencias);

// Rotas de sugestões de investimento
router.get('/investimentos/sugestoes', premiumController.obterSugestoesInvestimento);

// Rotas de alertas
router.get('/alertas', premiumController.listarAlertas);
router.put('/alertas/:id', premiumController.atualizarAlerta);
router.delete('/alertas/:id', premiumController.removerAlerta);

// Rotas de dados em tempo real
router.get('/tempo-real', premiumController.obterDadosTempoReal);

// Rotas de planejamento financeiro
router.get('/planejamento', premiumController.obterEstrategiasPlanejamento);

// Rotas de simulação de cenários
router.post('/simulacao', premiumController.simularCenarios);

// Rotas de suporte prioritário
router.post('/suporte', premiumController.criarTicketSuporte);

// Rota para fornecer conteúdo com degradação adaptativa
// Não requer autenticação, a degradação é baseada em parâmetros de query
router.get('/content/:contentId', premiumController.getDegradedContent);

// Rota para conteúdo premium com preview degradado
// O middleware permitirá acesso mas marcará o request como degradado
router.get('/preview/:contentId', 
  proteger,
  requireSubscription({
    allowedTypes: ['premium'],
    requireActive: true,
    degradedPreview: true
  }),
  premiumController.getDegradedContent
);

module.exports = router; 