const axios = require('axios');
const logger = require('../../utils/logger');

/**
 * Handler para redirecionar webhooks do Asaas da URL antiga para a nova
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 */
module.exports = async (req, res) => {
  try {
    // Configurar headers CORS adequados
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Responder a requisições preflight OPTIONS imediatamente
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Para requisições GET
    if (req.method === 'GET') {
      return res.status(200).json({
        message: "Este endpoint está obsoleto. Atualize a configuração do webhook do Asaas para usar a nova URL: https://backendapi-production-36b5.up.railway.app/api/assinatura/webhook",
        timestamp: new Date().toISOString(),
        status: "deprecated"
      });
    }
    
    // Capturar o payload completo do webhook
    const webhookData = req.body;
    
    // Registrar a recepção do webhook
    logger.info("[REDIRECTOR] Webhook do Asaas recebido na URL antiga", {
      event: webhookData?.event || 'UNKNOWN',
      timestamp: new Date().toISOString()
    });
    
    // Construir a URL da nova rota de webhook
    const newWebhookUrl = process.env.NEW_WEBHOOK_URL || 'https://backendapi-production-36b5.up.railway.app/api/assinatura/webhook';
    
    // Redirecionar o webhook para a nova URL
    try {
      const response = await axios.post(newWebhookUrl, webhookData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      logger.info("[REDIRECTOR] Webhook redirecionado com sucesso", {
        status: response.status,
        data: response.data
      });
      
      // Retornar a mesma resposta do serviço de destino
      return res.status(response.status).json(response.data);
    } catch (error) {
      logger.error("[REDIRECTOR] Erro ao redirecionar webhook", {
        error: error.message,
        stack: error.stack
      });
      
      // Se obtiver uma resposta do serviço, retornar com o mesmo status
      if (error.response) {
        return res.status(error.response.status).json({
          redirectorError: true,
          originalResponse: error.response.data
        });
      }
      
      // Caso contrário, retornar erro 502 (Bad Gateway)
      return res.status(502).json({
        error: "Falha ao redirecionar o webhook",
        message: error.message
      });
    }
  } catch (error) {
    logger.error("[REDIRECTOR] Erro ao processar webhook", {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: "Erro ao processar a requisição de webhook",
      message: error.message
    });
  }
}; 