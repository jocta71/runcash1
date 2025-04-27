/**
 * Rotas da API protegidas por autenticação JWT e assinatura ativa
 */

const express = require('express');
const router = express.Router();

// Importar middleware de autenticação e verificação de assinatura
const { verificarAutenticacaoEAssinatura } = require('../middleware/authAndAsaas');

// Importar router de roletas
const roletasRouter = require('./roletas');

// Rota pública - não requer autenticação nem assinatura
router.get('/public', (req, res) => {
  res.json({
    success: true,
    message: 'Rota pública acessível para todos',
    timestamp: new Date().toISOString()
  });
});

// Rotas protegidas - requerem autenticação JWT e assinatura ativa
router.use('/premium', verificarAutenticacaoEAssinatura);

// Registrar router de roletas na rota /api/roletas
router.use('/roletas', roletasRouter);

// Rota para obter dados das roletas
router.get('/premium/roletas', (req, res) => {
  // Neste ponto, o middleware já verificou o JWT e a assinatura ativa
  // Simular dados de roletas
  const roletas = [
    { id: 1, nome: "Roleta Suprema", estrategia: "Dupla por 3 vezes" },
    { id: 2, nome: "Roleta Vip", estrategia: "Dúzia por 5 vezes" },
    { id: 3, nome: "Roleta Premium", estrategia: "Baixa-Alta por 4 vezes" }
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
});

// Rota para obter estatísticas
router.get('/premium/estatisticas', (req, res) => {
  // Simular estatísticas
  const estatisticas = {
    totalJogos: 548,
    vitorias: 382,
    derrotas: 166,
    taxaVitoria: "69.7%",
    lucroMedio: "R$ 127,50 por dia"
  };
  
  res.json({
    success: true,
    message: 'Estatísticas recuperadas com sucesso',
    usuario: req.usuario.nome,
    data: estatisticas
  });
});

// Exportar router
module.exports = router; 