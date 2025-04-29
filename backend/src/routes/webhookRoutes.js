const express = require('express');
const router = express.Router();
const { isEventProcessed, saveEventToDatabase, updateEventStatus } = require('../services/webhookService');
const { processSubscriptionEvent, hasActivePlan, getCustomerSubscription, checkSubscriptionPayment } = require('../services/subscriptionService');

// Middleware para verificar token
const verifyAsaasToken = (req, res, next) => {
  const token = req.headers['asaas-access-token'];
  const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN || 'seu_token_webhook_asaas';
  
  if (!token || token !== configuredToken) {
    console.warn('[Webhook] Tentativa de acesso com token inválido:', token);
    return res.status(401).json({ error: 'Token inválido' });
  }
  
  next();
};

/**
 * Recebe webhooks do Asaas
 * POST /api/webhook/asaas
 */
router.post('/asaas', verifyAsaasToken, async (req, res) => {
  try {
    const event = req.body;
    
    // Validar evento
    if (!event || !event.event) {
      return res.status(400).json({ error: 'Evento inválido' });
    }
    
    // Log de evento recebido
    console.log(`[Webhook] Evento recebido: ${event.event} - ID: ${event.id || 'N/A'}`);
    
    // Verificar idempotência (não processar eventos duplicados)
    if (await isEventProcessed(event.id)) {
      console.log(`[Webhook] Evento ${event.id} já processado anteriormente, ignorando.`);
      return res.status(200).json({ message: 'Evento já processado' });
    }
    
    // Salvar evento no histórico
    await saveEventToDatabase(event);
    
    // Processar evento
    await processSubscriptionEvent(event);
    
    // Marcar evento como processado
    await updateEventStatus(event.id, 'processed');
    
    return res.status(200).json({ message: 'Evento processado com sucesso' });
    
  } catch (error) {
    console.error('[Webhook] Erro ao processar webhook:', error);
    
    // Se temos ID do evento, marcar como erro
    if (req.body && req.body.id) {
      await updateEventStatus(req.body.id, 'error', error.message);
    }
    
    return res.status(500).json({ error: 'Erro ao processar webhook' });
  }
});

/**
 * Consulta status de assinatura
 * GET /api/subscription/status/:customerId
 */
router.get('/subscription/status/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    if (!customerId) {
      return res.status(400).json({ error: 'ID do cliente é obrigatório' });
    }
    
    // Verificar acesso do cliente
    const hasAccess = await hasActivePlan(customerId);
    
    // Buscar detalhes da assinatura
    const subscription = await getCustomerSubscription(customerId);
    
    // Criar resposta
    const result = {
      hasAccess,
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        value: subscription.value,
        nextDueDate: subscription.nextDueDate,
        cycle: subscription.cycle
      } : null
    };
    
    // Se tiver assinatura, adicionar status de pagamento
    if (subscription) {
      result.hasConfirmedPayment = await checkSubscriptionPayment(subscription.id);
    }
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('[API] Erro ao consultar status da assinatura:', error);
    return res.status(500).json({ error: 'Erro ao consultar status' });
  }
});

/**
 * Estatísticas de webhooks (para monitoramento)
 * GET /api/webhook/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getWebhookStats();
    return res.status(200).json(stats);
  } catch (error) {
    console.error('[API] Erro ao obter estatísticas de webhooks:', error);
    return res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

module.exports = router; 