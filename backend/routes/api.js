const express = require('express');
const router = express.Router();
const path = require('path');

// Importar o manipulador de redirecionamento de webhook
let webhookRedirector;
try {
  webhookRedirector = require('../api/payment/asaas-webhook-handler');
} catch (err) {
  console.warn('Aviso: Manipulador de redirecionamento de webhook não encontrado');
  // Criar um manipulador padrão caso o arquivo não exista
  webhookRedirector = (req, res) => {
    res.status(200).json({
      message: "Webhook endpoint obsoleto. Atualize para a nova URL",
      status: "deprecated"
    });
  };
}

// Middleware para verificar token JWT
const verifyToken = (req, res, next) => {
  // Obter token do cabeçalho Authorization
  const bearerHeader = req.headers['authorization'];
  
  if (typeof bearerHeader !== 'undefined') {
    // Dividir a string 'Bearer <token>'
    const bearer = bearerHeader.split(' ');
    const token = bearer[1];
    
    // Verificar se o token existe
    if (token) {
      // Armazenar o token na requisição
      req.token = token;
      
      // Em uma implementação real, você verificaria a validade do token aqui
      // Para este exemplo, apenas simulamos um usuário autenticado
      req.usuario = {
        id: 'user123',
        email: 'usuario@exemplo.com',
        nome: 'Usuário Teste'
      };
      
      // Continuar para o próximo middleware
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Token inválido',
        error: 'INVALID_TOKEN'
      });
    }
  } else {
    // Se não houver token, retornar erro
    return res.status(403).json({
      success: false,
      message: 'Acesso não autorizado',
      error: 'NO_TOKEN'
    });
  }
};

// Rota para planos de assinatura
router.get('/assinatura/planos', (req, res) => {
  // Retornar planos disponíveis
  res.status(200).json({
    success: true,
    message: 'Planos disponíveis recuperados com sucesso',
    data: {
      planos: [
        {
          id: 'mensal',
          nome: 'Plano Mensal',
          valor: 29.90,
          intervalo: 'mensal',
          descricao: 'Acesso a recursos premium por 1 mês',
          recursos: [
            'Acesso aos dados de todas as roletas',
            'Histórico de números das roletas',
            'Estatísticas básicas',
            'Exportação de dados CSV'
          ]
        },
        {
          id: 'trimestral',
          nome: 'Plano Trimestral',
          valor: 79.90,
          intervalo: 'trimestral',
          descricao: 'Acesso a recursos premium por 3 meses',
          recursos: [
            'Acesso aos dados de todas as roletas',
            'Histórico de números das roletas',
            'Estatísticas avançadas',
            'Exportação de dados CSV',
            'Alerta de números quentes'
          ],
          economia: '11% de desconto em relação ao plano mensal'
        },
        {
          id: 'anual',
          nome: 'Plano Anual',
          valor: 299.90,
          intervalo: 'anual',
          descricao: 'Acesso a recursos premium por 12 meses',
          recursos: [
            'Acesso aos dados de todas as roletas',
            'Histórico de números das roletas',
            'Estatísticas avançadas',
            'Exportação de dados CSV',
            'Alerta de números quentes',
            'Atualização em tempo real',
            'Análise de padrões com IA',
            'Suporte prioritário'
          ],
          economia: '16% de desconto em relação ao plano mensal'
        }
      ]
    }
  });
});

// Rota para obter status da assinatura
router.get('/assinatura/status', verifyToken, (req, res) => {
  // Simular um usuário com assinatura
  // Em uma implementação real, você buscaria isso do banco de dados
  res.status(200).json({
    success: true,
    message: 'Informações da assinatura recuperadas com sucesso',
    data: {
      possuiAssinatura: true,
      status: 'ativa',
      plano: 'trimestral',
      dataInicio: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
      validade: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString(),
      renovacaoAutomatica: true,
      diasRestantes: 60
    }
  });
});

// Rota para criar checkout de assinatura
router.post('/assinatura/checkout', verifyToken, (req, res) => {
  const { planoId } = req.body;
  
  // Verificar se o plano é válido
  if (!planoId || !['mensal', 'trimestral', 'anual'].includes(planoId)) {
    return res.status(400).json({
      success: false,
      message: 'Plano inválido',
      error: 'INVALID_PLAN'
    });
  }
  
  // Simulação de criação de checkout (em produção, integraria com o Asaas)
  // URL de exemplo para simulação
  const checkoutUrl = `https://checkout.asaas.com/simulate?plan=${planoId}&user=${req.usuario.id}`;
  
  res.status(200).json({
    success: true,
    message: 'Checkout criado com sucesso',
    checkoutUrl: checkoutUrl
  });
});

// Exportar o router
module.exports = router; 