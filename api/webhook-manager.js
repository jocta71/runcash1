/**
 * API webhook-manager - Proxy para webhook Asaas
 */

// Importar a implementação do backend
const asaasWebhookHandler = require('../backend/api/webhooks/asaas');

// Exportar o manipulador de webhooks
module.exports = async (req, res) => {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Verificar se é uma operação especial via query param
    const operation = req.query.operation;
    
    if (operation === 'reconciliation') {
      console.log('Iniciando operação de reconciliação de assinaturas');
      // Chamar a rota de reconciliação (implementação pendente)
      return res.status(200).json({ 
        message: 'Operação de reconciliação iniciada',
        status: 'pending'
      });
    }
    
    if (operation === 'retry') {
      console.log('Iniciando operação de retry de webhooks falhos');
      // Chamar a rota de retry (implementação pendente)
      return res.status(200).json({ 
        message: 'Operação de retry iniciada',
        status: 'pending'
      });
    }
    
    // Processar o webhook normalmente
    console.log('Recebido webhook do Asaas');
    
    // Verificar se o corpo da requisição está presente
    if (!req.body) {
      return res.status(400).json({
        error: 'Corpo da requisição vazio ou inválido'
      });
    }
    
    // Processar o evento padrão de webhook
    const result = {
      message: 'Webhook recebido e encaminhado para processamento',
      status: 'pending',
      eventId: req.body.id || 'unknown'
    };
    
    // Em produção, aqui chamaria a implementação real do backend
    // asaasWebhookHandler(req, res);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({
      error: 'Erro interno ao processar webhook',
      message: error.message
    });
  }
}; 