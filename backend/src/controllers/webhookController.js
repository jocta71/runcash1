const logger = require('../utils/logger');
const webhookService = require('../services/webhookService');
const config = require('../config');

/**
 * Controller para gerenciar os endpoints de webhook
 */
class WebhookController {
  /**
   * Valida o token de autenticação do webhook
   * @param {object} req - Objeto de requisição
   * @returns {boolean} - Verdadeiro se o token for válido
   */
  validateWebhookToken(req) {
    const token = req.headers['x-webhook-token'] || req.query.token;
    return token === config.webhooks.asaas.token;
  }

  /**
   * Processa um webhook do Asaas
   * @param {object} req - Objeto de requisição
   * @param {object} res - Objeto de resposta
   */
  async handleAsaasWebhook(req, res) {
    try {
      // Validar método HTTP
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
      }

      // Validar token de segurança (se configurado)
      if (config.webhooks.asaas.token && !this.validateWebhookToken(req)) {
        logger.warn(`Tentativa de acesso ao webhook com token inválido: ${req.ip}`);
        return res.status(401).json({ error: 'Token inválido' });
      }

      const payload = req.body;
      const eventType = payload.event;
      const eventId = payload.id || `asaas_${Date.now()}`;

      logger.info(`Webhook Asaas recebido: ${eventType} (ID: ${eventId})`);

      // Verificar idempotência - se o evento já foi processado
      const alreadyProcessed = await webhookService.isEventProcessed('ASAAS', eventId, eventType);
      if (alreadyProcessed) {
        logger.info(`Evento ${eventId} já foi processado anteriormente, ignorando`);
        return res.status(200).json({ message: 'Evento já processado', eventId });
      }

      // Registrar evento
      const event = await webhookService.recordEvent('ASAAS', eventId, eventType, payload);

      // Processar o evento de acordo com o tipo
      let result;
      try {
        switch (eventType) {
          case 'PAYMENT_RECEIVED':
            result = await webhookService.processPaymentReceived(payload);
            break;
          case 'PAYMENT_CONFIRMED':
            result = await webhookService.processPaymentConfirmed(payload);
            break;
          case 'PAYMENT_OVERDUE':
            result = await webhookService.processPaymentOverdue(payload);
            break;
          case 'PAYMENT_REFUNDED':
            result = await webhookService.processPaymentCancelled(payload, 'REFUNDED');
            break;
          case 'PAYMENT_DELETED':
            result = await webhookService.processPaymentCancelled(payload, 'DELETED');
            break;
          case 'PAYMENT_CANCELLED':
            result = await webhookService.processPaymentCancelled(payload, 'CANCELLED');
            break;
          case 'SUBSCRIPTION_CREATED':
            result = await webhookService.processSubscriptionCreated(payload);
            break;
          case 'SUBSCRIPTION_UPDATED':
            result = await webhookService.processSubscriptionUpdated(payload);
            break;
          case 'SUBSCRIPTION_CANCELLED':
            result = await webhookService.processSubscriptionCancelled(payload);
            break;
          default:
            logger.warn(`Tipo de evento não processado: ${eventType}`);
            result = { success: true, message: 'Evento recebido, mas não processado' };
        }

        // Marcar evento como processado
        await webhookService.markEventProcessed(event.id, 'PROCESSED');
      } catch (error) {
        logger.error(`Erro ao processar evento ${eventId} do tipo ${eventType}:`, error);
        
        // Marcar evento como erro
        await webhookService.markEventProcessed(event.id, 'ERROR', error.message);
        
        // Ainda retornamos 200 para Asaas não reenviar o webhook
        return res.status(200).json({
          message: 'Evento recebido, mas ocorreu um erro no processamento',
          eventId,
          success: false,
          error: error.message
        });
      }

      return res.status(200).json({
        message: 'Evento processado com sucesso',
        eventId,
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Erro ao processar webhook Asaas:', error);
      return res.status(500).json({ error: 'Erro interno' });
    }
  }

  /**
   * Retorna estatísticas sobre eventos de webhook
   * @param {object} req - Objeto de requisição
   * @param {object} res - Objeto de resposta
   */
  async getStats(req, res) {
    try {
      const stats = await webhookService.getWebhookStats();
      return res.status(200).json(stats);
    } catch (error) {
      logger.error('Erro ao obter estatísticas de webhook:', error);
      return res.status(500).json({ error: 'Erro interno' });
    }
  }

  /**
   * Retorna a lista de eventos
   * @param {object} req - Objeto de requisição
   * @param {object} res - Objeto de resposta
   */
  async listEvents(req, res) {
    try {
      const filters = {
        eventType: req.query.eventType,
        status: req.query.status,
        provider: req.query.provider,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const events = await webhookService.listWebhookEvents(filters);
      return res.status(200).json(events);
    } catch (error) {
      logger.error('Erro ao listar eventos de webhook:', error);
      return res.status(500).json({ error: 'Erro interno' });
    }
  }
}

module.exports = new WebhookController(); 