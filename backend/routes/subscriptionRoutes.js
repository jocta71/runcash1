/**
 * Rotas para gerenciamento de assinaturas
 * Inclui verificação de status, gerenciamento de planos e webhooks
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { getSubscriptionStatus } = require('../api/subscription/status');

/**
 * @route   GET /api/subscription/status
 * @desc    Verifica status da assinatura do usuário
 * @access  Público - Não requer autenticação, mas fornece mais infos se autenticado
 */
router.get('/status', protect, getSubscriptionStatus);

/**
 * @route   GET /api/subscription/plans
 * @desc    Retorna informações sobre os planos disponíveis
 * @access  Público - Qualquer usuário pode ver os planos
 */
router.get('/plans', (req, res) => {
  // Definição dos planos disponíveis
  const plans = [
    {
      id: 'mensal',
      name: 'Plano Mensal',
      value: 49.90,
      cycle: 'MONTHLY',
      description: 'Acesso a todas as roletas pelo período de 1 mês',
      benefits: [
        'Acesso a todas as roletas',
        'Suporte por email',
        'Histórico de resultados'
      ]
    },
    {
      id: 'trimestral',
      name: 'Plano Trimestral',
      value: 129.90,
      cycle: 'QUARTERLY',
      description: 'Acesso a todas as roletas pelo período de 3 meses',
      benefits: [
        'Acesso a todas as roletas',
        'Suporte prioritário',
        'Histórico de resultados',
        'Estatísticas avançadas'
      ]
    },
    {
      id: 'anual',
      name: 'Plano Anual',
      value: 449.90,
      cycle: 'YEARLY',
      description: 'Acesso a todas as roletas pelo período de 12 meses',
      benefits: [
        'Acesso a todas as roletas',
        'Suporte VIP',
        'Histórico de resultados',
        'Estatísticas avançadas',
        'Notificações em tempo real',
        'Economia de 25% em relação ao plano mensal'
      ]
    }
  ];
  
  // Retorna os planos disponíveis
  return res.status(200).json({
    success: true,
    plans
  });
});

module.exports = router; 