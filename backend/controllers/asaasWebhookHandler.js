/**
 * Controlador para webhook do Asaas 
 * Formato compatível com as requisições do frontend
 */

const { processWebhook } = require('./asaasWebhookController');

/**
 * Processa webhook do Asaas no formato esperado pelo frontend
 */
exports.handleAsaasWebhook = async (req, res) => {
  try {
    console.log('[AsaasWebhook] Recebido webhook do Asaas');
    
    // Verificar se o webhook tem o formato correto
    if (!req.body || !req.body.event) {
      console.error('[AsaasWebhook] Webhook sem evento');
      return res.status(400).json({
        success: false,
        message: 'Evento ausente no webhook'
      });
    }
    
    // Passar para o processador de webhook
    await processWebhook(req, res);
    
  } catch (error) {
    console.error('[AsaasWebhook] Erro ao processar webhook:', error);
    
    // Retornar 200 mesmo em caso de erro para não reprocessar o webhook
    return res.status(200).json({
      success: true,
      processed: false,
      error: error.message
    });
  }
}; 