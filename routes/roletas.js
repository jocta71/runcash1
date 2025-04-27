/**
 * Rotas da API de roletas protegidas por autenticação JWT e assinatura ativa
 */

const express = require('express');
const router = express.Router();

// Importar middleware de autenticação e verificação de assinatura
const { verificarAutenticacaoEAssinatura } = require('../middleware/authAndAsaas');

// Aplicar middleware em todas as rotas deste router
router.use(verificarAutenticacaoEAssinatura);

/**
 * @route GET /api/roletas
 * @desc Obter lista de roletas disponíveis 
 * @access Privado (requer JWT válido e assinatura ativa)
 */
router.get('/', async (req, res) => {
  try {
    // Aqui poderia buscar dados reais do banco de dados
    const roletas = [
      { 
        id: 1, 
        nome: "Roleta Suprema", 
        provedor: "Evolution",
        ultimosNumeros: [7, 32, 15, 8, 21, 3],
        estrategia: "Dupla por 3 vezes" 
      },
      { 
        id: 2, 
        nome: "Roleta Vip", 
        provedor: "Pragmatic",
        ultimosNumeros: [12, 28, 4, 33, 19, 10],
        estrategia: "Dúzia por 5 vezes" 
      },
      { 
        id: 3, 
        nome: "Roleta Premium", 
        provedor: "Playtech",
        ultimosNumeros: [5, 22, 14, 31, 9, 25],
        estrategia: "Baixa-Alta por 4 vezes" 
      }
    ];
    
    res.json({
      success: true,
      message: 'Dados das roletas recuperados com sucesso',
      usuario: {
        id: req.usuario.id,
        nome: req.usuario.nome
      },
      assinatura: {
        id: req.assinatura.id,
        status: req.assinatura.status,
        proxPagamento: req.assinatura.proxPagamento
      },
      data: roletas
    });
  } catch (error) {
    console.error('Erro ao buscar roletas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados das roletas',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/roletas/:id
 * @desc Obter detalhes de uma roleta específica
 * @access Privado (requer JWT válido e assinatura ativa)
 */
router.get('/:id', async (req, res) => {
  try {
    const roletaId = parseInt(req.params.id);
    
    // Simular busca por ID (em produção seria do banco de dados)
    const roleta = {
      id: roletaId,
      nome: `Roleta ${roletaId}`,
      provedor: "Evolution",
      ultimosNumeros: [7, 32, 15, 8, 21, 3, 17, 29, 11, 20],
      estatisticas: {
        quentes: [7, 15, 3],
        frios: [0, 2, 34],
        ausentes: [18, 27, 36]
      },
      estrategias: [
        { nome: "Dupla por 3 vezes", confianca: 92 },
        { nome: "Coluna após 4 números", confianca: 85 }
      ]
    };
    
    res.json({
      success: true,
      message: 'Detalhes da roleta recuperados com sucesso',
      data: roleta
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes da roleta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar detalhes da roleta',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/roletas/:id/historico
 * @desc Obter histórico completo de números de uma roleta
 * @access Privado (requer JWT válido e assinatura ativa)
 */
router.get('/:id/historico', async (req, res) => {
  try {
    const roletaId = parseInt(req.params.id);
    
    // Simular dados históricos (em produção seria do banco de dados)
    const historico = {
      roleta_id: roletaId,
      nome: `Roleta ${roletaId}`,
      numeros: [
        { numero: 7, timestamp: new Date(Date.now() - 60000).toISOString() },
        { numero: 32, timestamp: new Date(Date.now() - 120000).toISOString() },
        { numero: 15, timestamp: new Date(Date.now() - 180000).toISOString() },
        { numero: 8, timestamp: new Date(Date.now() - 240000).toISOString() },
        { numero: 21, timestamp: new Date(Date.now() - 300000).toISOString() }
      ]
    };
    
    res.json({
      success: true,
      message: 'Histórico da roleta recuperado com sucesso',
      data: historico
    });
  } catch (error) {
    console.error('Erro ao buscar histórico da roleta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar histórico da roleta',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router; 