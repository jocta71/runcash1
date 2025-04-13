/**
 * Redirecionador para o webhook do Asaas
 * 
 * Este arquivo encaminha as requisições do webhook do Asaas
 * para o arquivo correto em /api/payment/asaas-webhook.js
 */

// Importar o handler do arquivo original
const webhookHandler = require('../backend/api/payment/asaas-webhook');

// Exportar um wrapper do handler com logs adicionais
module.exports = async (req, res) => {
  console.log('[ASAAS WEBHOOK REDIRECT] Recebida requisição no caminho /api/asaas-webhook');
  console.log('[ASAAS WEBHOOK REDIRECT] Método:', req.method);
  console.log('[ASAAS WEBHOOK REDIRECT] Cabeçalhos:', JSON.stringify(req.headers));
  console.log('[ASAAS WEBHOOK REDIRECT] Corpo:', JSON.stringify(req.body));
  
  console.log('[ASAAS WEBHOOK REDIRECT] Redirecionando para o handler em /api/payment/asaas-webhook');
  
  try {
    // Chamar o handler original
    return await webhookHandler(req, res);
  } catch (error) {
    console.error('[ASAAS WEBHOOK REDIRECT] Erro ao processar webhook:', error);
    
    // Garantir que respondemos com algo em caso de erro
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Erro interno ao processar webhook',
        message: error.message
      });
    }
  }
}; 