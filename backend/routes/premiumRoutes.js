/**
 * Rotas para funcionalidades premium
 */

const express = require('express');
const router = express.Router();
const { proteger } = require('../middlewares/authMiddleware');
const { verificarPlano } = require('../middleware/assinaturaMiddleware');
const premiumController = require('../controllers/premiumController');

// Aplicar middleware de autenticação em todas as rotas
router.use(proteger);

// Aplicar middleware para verificar plano premium
router.use(verificarPlano(['premium', 'empresarial']));

// Rotas de relatórios financeiros
router.get('/relatorios', premiumController.obterRelatoriosFinanceiros);

// Rotas de exportação de dados
router.post('/exportar', premiumController.exportarDados);

// Rotas de análise de tendências
router.post('/tendencias', premiumController.analisarTendencias);

// Rotas de sugestões de investimento
router.get('/investimentos/sugestoes', premiumController.obterSugestoesInvestimento);

// Rotas de alertas
router.post('/alertas', premiumController.configurarAlertas);
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

module.exports = router; 