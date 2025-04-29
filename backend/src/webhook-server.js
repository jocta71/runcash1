const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Armazenamento em memória para eventos recebidos (para servidores que não têm acesso ao localStorage)
const eventStorage = {
  webhookEvents: [],
  subscriptionCache: {},
  paymentCache: {}
};

// Inicializar o app Express
const app = express();

// Configurar middlewares
app.use(cors());
app.use(bodyParser.json());

// Rota principal para webhooks da Asaas
app.post('/api/asaas-webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log(`[ASAAS Webhook] Evento recebido: ${event.event}`);

    // Registrar evento para histórico
    recordWebhookEvent(event);

    // Processar o evento de acordo com o tipo
    switch (event.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        await handlePaymentConfirmed(event);
        break;
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(event);
        break;
      case 'SUBSCRIPTION_CREATED':
        await handleSubscriptionCreated(event);
        break;
      case 'SUBSCRIPTION_UPDATED':
        await handleSubscriptionUpdated(event);
        break;
      case 'SUBSCRIPTION_CANCELLED':
        await handleSubscriptionCancelled(event);
        break;
    }

    // Responder com sucesso (status 200) para confirmar recebimento
    return res.status(200).json({ 
      success: true, 
      message: 'Webhook processado com sucesso' 
    });
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar webhook:', error);
    // Ainda retornar 200 para não bloquear a fila de webhooks da Asaas
    return res.status(200).json({ 
      success: false, 
      error: 'Erro interno, mas recebido' 
    });
  }
});

// Rota para consultar histórico de eventos
app.get('/api/webhook-events', (req, res) => {
  return res.json(eventStorage.webhookEvents);
});

// Rota para consultar status de assinatura
app.get('/api/subscription-status/:subscriptionId', (req, res) => {
  const { subscriptionId } = req.params;
  
  if (eventStorage.subscriptionCache[subscriptionId]) {
    return res.json(eventStorage.subscriptionCache[subscriptionId]);
  }
  
  return res.status(404).json({ 
    success: false, 
    error: 'Assinatura não encontrada' 
  });
});

// Rota para consultar status de pagamento
app.get('/api/payment-status/:paymentId', (req, res) => {
  const { paymentId } = req.params;
  
  if (eventStorage.paymentCache[paymentId]) {
    return res.json(eventStorage.paymentCache[paymentId]);
  }
  
  return res.status(404).json({ 
    success: false, 
    error: 'Pagamento não encontrado' 
  });
});

// Rota para consultar assinaturas do usuário
app.get('/api/user-subscriptions/:customerId', (req, res) => {
  const { customerId } = req.params;
  
  // Filtrar assinaturas pelo customerId
  const userSubscriptions = Object.values(eventStorage.subscriptionCache)
    .filter(sub => sub.customerId === customerId);
  
  return res.json(userSubscriptions);
});

// Rota de status/health check
app.get('/api/webhook-status', (req, res) => {
  return res.json({ 
    status: 'online',
    eventsReceived: eventStorage.webhookEvents.length,
    subscriptionsTracked: Object.keys(eventStorage.subscriptionCache).length,
    paymentsTracked: Object.keys(eventStorage.paymentCache).length,
    timestamp: new Date().toISOString()
  });
});

// Funções de tratamento de eventos

// Registra o evento para histórico e debug
function recordWebhookEvent(event) {
  try {
    // Adicionar novo evento ao histórico
    eventStorage.webhookEvents.push({
      event: event.event,
      paymentId: event.payment?.id,
      subscriptionId: event.subscription?.id || event.payment?.subscription,
      customerId: event.payment?.customer || event.subscription?.customer,
      status: event.payment?.status || event.subscription?.status,
      timestamp: new Date().toISOString()
    });
    
    // Limitar histórico a 100 eventos
    if (eventStorage.webhookEvents.length > 100) {
      eventStorage.webhookEvents = eventStorage.webhookEvents.slice(-100);
    }
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao registrar evento:', error);
  }
}

// Processa pagamento confirmado
async function handlePaymentConfirmed(event) {
  if (!event.payment) return;
  
  try {
    // Se esse pagamento for de uma assinatura, atualizar cache da assinatura
    if (event.payment.subscription) {
      // Atualizar cache de assinatura
      updateSubscriptionCache(event.payment.subscription, 'active', event.payment.customer);
    }
    
    // Atualizar status de pagamento
    updatePaymentCache(event.payment.id, 'confirmed', event.payment.customer);
    
    console.log(`[ASAAS Webhook] Pagamento ${event.payment.id} confirmado para assinatura ${event.payment.subscription}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar pagamento confirmado:', error);
  }
}

// Processa pagamento atrasado
async function handlePaymentOverdue(event) {
  if (!event.payment) return;
  
  try {
    // Se esse pagamento for de uma assinatura, atualizar cache da assinatura
    if (event.payment.subscription) {
      // Atualizar cache de assinatura
      updateSubscriptionCache(event.payment.subscription, 'inactive', event.payment.customer);
    }
    
    // Atualizar status de pagamento
    updatePaymentCache(event.payment.id, 'overdue', event.payment.customer);
    
    console.log(`[ASAAS Webhook] Pagamento ${event.payment.id} atrasado para assinatura ${event.payment.subscription}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar pagamento atrasado:', error);
  }
}

// Processa criação de assinatura
async function handleSubscriptionCreated(event) {
  if (!event.subscription) return;
  
  try {
    // Atualizar cache de assinatura - iniciando com status da assinatura
    updateSubscriptionCache(
      event.subscription.id, 
      event.subscription.status.toLowerCase(), 
      event.subscription.customer
    );
    
    console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} criada com status ${event.subscription.status}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar criação de assinatura:', error);
  }
}

// Processa atualização de assinatura
async function handleSubscriptionUpdated(event) {
  if (!event.subscription) return;
  
  try {
    // Atualizar cache de assinatura com o status atual
    updateSubscriptionCache(
      event.subscription.id, 
      event.subscription.status.toLowerCase(), 
      event.subscription.customer
    );
    
    console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} atualizada para status ${event.subscription.status}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar atualização de assinatura:', error);
  }
}

// Processa cancelamento de assinatura
async function handleSubscriptionCancelled(event) {
  if (!event.subscription) return;
  
  try {
    // Atualizar cache de assinatura para inativa
    updateSubscriptionCache(event.subscription.id, 'inactive', event.subscription.customer);
    
    console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} cancelada`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar cancelamento de assinatura:', error);
  }
}

// Atualiza o cache de assinatura
function updateSubscriptionCache(
  subscriptionId, 
  status,
  customerId
) {
  try {
    const cacheData = {
      id: subscriptionId,
      status: status,
      isActive: status === 'active' || status === 'ativo',
      isPending: status === 'pending' || status === 'pendente',
      customerId: customerId,
      updatedAt: new Date().toISOString(),
      timestamp: Date.now()
    };
    
    // Atualizar cache em memória
    eventStorage.subscriptionCache[subscriptionId] = cacheData;
    
    console.log(`[ASAAS Webhook] Cache de assinatura ${subscriptionId} atualizado para status ${status}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao atualizar cache de assinatura:', error);
  }
}

// Atualiza o cache de pagamento
function updatePaymentCache(
  paymentId, 
  status, 
  customerId
) {
  try {
    const cacheData = {
      id: paymentId,
      status: status,
      customerId: customerId,
      updatedAt: new Date().toISOString(),
      timestamp: Date.now()
    };
    
    // Atualizar cache em memória
    eventStorage.paymentCache[paymentId] = cacheData;
    
    console.log(`[ASAAS Webhook] Cache de pagamento ${paymentId} atualizado para status ${status}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao atualizar cache de pagamento:', error);
  }
}

// Iniciar o servidor na porta 3030 (ou outra porta conforme configuração)
const PORT = process.env.WEBHOOK_PORT || 3030;

app.listen(PORT, () => {
  console.log(`[ASAAS Webhook] Servidor iniciado na porta ${PORT}`);
  console.log(`[ASAAS Webhook] Endpoint: http://localhost:${PORT}/api/asaas-webhook`);
});

module.exports = app; 