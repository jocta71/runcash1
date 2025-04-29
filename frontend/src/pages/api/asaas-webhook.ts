// API endpoint para receber webhooks do Asaas
// Este endpoint processa eventos de pagamento e assinatura

// Define os tipos para requisição e resposta da API
interface ApiRequest {
  method: string;
  body: any;
  headers: Record<string, string>;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: any) => void;
}

// Define os tipos de evento que podemos receber da Asaas
type AsaasEventType = 
  | 'PAYMENT_CREATED' 
  | 'PAYMENT_UPDATED' 
  | 'PAYMENT_CONFIRMED' 
  | 'PAYMENT_RECEIVED' 
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_REFUND_FAILED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_UPDATED'
  | 'SUBSCRIPTION_CANCELLED';

interface AsaasWebhookEvent {
  event: AsaasEventType;
  payment?: {
    id: string;
    subscription?: string;
    customer: string;
    status: 'CONFIRMED' | 'RECEIVED' | 'PENDING' | 'OVERDUE';
    value: number;
    description?: string;
  };
  subscription?: {
    id: string;
    customer: string;
    status: string;
    value: number;
  };
}

// Status de assinatura válidos considerados como "ativos"
const VALID_SUBSCRIPTION_STATUSES = ['ACTIVE', 'active'];

// Status de assinatura que devem ser explicitamente rejeitados
const INVALID_SUBSCRIPTION_STATUSES = ['PENDING', 'pending', 'INACTIVE', 'inactive', 'CANCELLED', 'cancelled'];

// Processador de eventos para webhooks da Asaas
export default async function handler(
  req: ApiRequest,
  res: ApiResponse
) {
  // Apenas permitir método POST para webhooks
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body as AsaasWebhookEvent;
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
    return res.status(200).json({ success: true, message: 'Webhook processado com sucesso' });
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar webhook:', error);
    // Ainda retornar 200 para não bloquear a fila de webhooks da Asaas
    return res.status(200).json({ success: false, error: 'Erro interno, mas recebido' });
  }
}

// Armazenamento em memória para eventos recebidos (máximo 100)
const webhookEvents: AsaasWebhookEvent[] = [];

// Registra um evento recebido
function recordWebhookEvent(event: AsaasWebhookEvent) {
  webhookEvents.unshift(event);
  if (webhookEvents.length > 100) {
    webhookEvents.pop();
  }
  
  // Registrar em localStorage se disponível (usado para debugging)
  if (typeof localStorage !== 'undefined') {
    try {
      // Obter eventos existentes ou inicializar array
      const storedEvents = JSON.parse(localStorage.getItem('asaas_webhook_events') || '[]');
      
      // Adicionar novo evento com timestamp
      storedEvents.unshift({
        ...event,
        receivedAt: new Date().toISOString()
      });
      
      // Limitar a 50 eventos
      if (storedEvents.length > 50) {
        storedEvents.length = 50;
      }
      
      localStorage.setItem('asaas_webhook_events', JSON.stringify(storedEvents));
    } catch (e) {
      console.error('[ASAAS Webhook] Erro ao salvar evento no localStorage:', e);
    }
  }
}

// Atualiza o cache de assinaturas
function updateSubscriptionCache(subscriptionId: string, status: string, customerId: string) {
  if (typeof localStorage === 'undefined') return;
  
  try {
    // 1. Atualizar cache específico da assinatura
    const subscriptionCache = {
      id: subscriptionId,
      status: status,
      customerId: customerId,
      updatedAt: new Date().toISOString(),
      isActive: VALID_SUBSCRIPTION_STATUSES.includes(status.toUpperCase()),
      isPending: status.toUpperCase() === 'PENDING'
    };
    
    localStorage.setItem(`asaas_subscription_${subscriptionId}`, JSON.stringify(subscriptionCache));
    
    // 2. Atualizar cache do usuário
    const userCacheString = localStorage.getItem('auth_user_cache');
    if (userCacheString) {
      const userData = JSON.parse(userCacheString);
      
      // Só atualizar se for o usuário correto
      if (userData.asaasCustomerId === customerId) {
        // Atualizar dados de assinatura
        userData.subscription = {
          ...userData.subscription,
          id: subscriptionId,
          status: status,
          active: VALID_SUBSCRIPTION_STATUSES.includes(status.toUpperCase()),
          pending: status.toUpperCase() === 'PENDING',
          updatedAt: new Date().toISOString()
        };
        
        localStorage.setItem('auth_user_cache', JSON.stringify(userData));
      }
    }
    
    // 3. Atualizar asaas_subscription_cache usado pelo GlobalRouletteDataService
    const asaasSubscriptionCache = {
      id: subscriptionId,
      status: status,
      isActive: VALID_SUBSCRIPTION_STATUSES.includes(status.toUpperCase()),
      isPending: status.toUpperCase() === 'PENDING',
      customerId: customerId,
      timestamp: Date.now()
    };
    
    localStorage.setItem('asaas_subscription_cache', JSON.stringify(asaasSubscriptionCache));
    
    console.log(`[ASAAS Webhook] Cache de assinatura atualizado: ${subscriptionId}, status=${status}`);
  } catch (e) {
    console.error('[ASAAS Webhook] Erro ao atualizar cache de assinatura:', e);
  }
}

// Atualiza o cache de pagamentos
function updatePaymentCache(paymentId: string, status: string, subscriptionId?: string) {
  if (typeof localStorage === 'undefined') return;
  
  try {
    // Atualizar cache do pagamento
    const paymentCache = {
      id: paymentId,
      status: status,
      subscriptionId: subscriptionId,
      updatedAt: new Date().toISOString(),
      isConfirmed: status === 'CONFIRMED' || status === 'RECEIVED'
    };
    
    localStorage.setItem(`asaas_payment_${paymentId}`, JSON.stringify(paymentCache));
    
    // Se estiver vinculado a uma assinatura, também atualizar o cache desta
    if (subscriptionId) {
      const subscriptionCacheString = localStorage.getItem(`asaas_subscription_${subscriptionId}`);
      if (subscriptionCacheString) {
        const subscriptionCache = JSON.parse(subscriptionCacheString);
        
        subscriptionCache.lastPayment = {
          id: paymentId,
          status: status,
          updatedAt: new Date().toISOString()
        };
        
        // Se o pagamento for confirmado, atualizar flag de pagamento confirmado da assinatura
        if (status === 'CONFIRMED' || status === 'RECEIVED') {
          subscriptionCache.hasConfirmedPayment = true;
        } else if (status === 'OVERDUE') {
          subscriptionCache.hasConfirmedPayment = false;
        }
        
        localStorage.setItem(`asaas_subscription_${subscriptionId}`, JSON.stringify(subscriptionCache));
      }
      
      // Atualizar asaas_subscription_cache usado pelo GlobalRouletteDataService
      const asaasSubscriptionCacheString = localStorage.getItem('asaas_subscription_cache');
      if (asaasSubscriptionCacheString) {
        const asaasSubscriptionCache = JSON.parse(asaasSubscriptionCacheString);
        
        if (asaasSubscriptionCache.id === subscriptionId) {
          asaasSubscriptionCache.lastPayment = {
            id: paymentId,
            status: status,
            updatedAt: new Date().toISOString()
          };
          
          // Atualizar flag de pagamento confirmado
          if (status === 'CONFIRMED' || status === 'RECEIVED') {
            asaasSubscriptionCache.hasConfirmedPayment = true;
          } else if (status === 'OVERDUE') {
            asaasSubscriptionCache.hasConfirmedPayment = false;
          }
          
          localStorage.setItem('asaas_subscription_cache', JSON.stringify(asaasSubscriptionCache));
        }
      }
    }
    
    console.log(`[ASAAS Webhook] Cache de pagamento atualizado: ${paymentId}, status=${status}`);
  } catch (e) {
    console.error('[ASAAS Webhook] Erro ao atualizar cache de pagamento:', e);
  }
}

// Processa pagamento confirmado ou recebido
async function handlePaymentConfirmed(event: AsaasWebhookEvent) {
  if (!event.payment) return;
  
  try {
    // Atualizar cache de pagamento
    updatePaymentCache(
      event.payment.id, 
      event.payment.status, 
      event.payment.subscription
    );
    
    // Se o pagamento estiver vinculado a uma assinatura, verificar se a assinatura está ativa
    if (event.payment.subscription) {
      try {
        // Buscar detalhes da assinatura (opcional, para atualizar status completo)
        const response = await fetch(`/api/asaas-find-subscription?subscriptionId=${event.payment.subscription}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.subscription) {
            // Atualizar cache de assinatura
            updateSubscriptionCache(
              event.payment.subscription,
              data.subscription.status,
              event.payment.customer
            );
          }
        }
      } catch (error) {
        console.error('[ASAAS Webhook] Erro ao buscar detalhes da assinatura:', error);
      }
    }
    
    console.log(`[ASAAS Webhook] Pagamento ${event.payment.id} confirmado/recebido`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar pagamento confirmado:', error);
  }
}

// Processa pagamento em atraso
async function handlePaymentOverdue(event: AsaasWebhookEvent) {
  if (!event.payment) return;
  
  try {
    // Atualizar cache de pagamento
    updatePaymentCache(
      event.payment.id, 
      'OVERDUE', 
      event.payment.subscription
    );
    
    console.log(`[ASAAS Webhook] Pagamento ${event.payment.id} em atraso`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar pagamento em atraso:', error);
  }
}

// Processa criação de assinatura
async function handleSubscriptionCreated(event: AsaasWebhookEvent) {
  if (!event.subscription) return;
  
  try {
    // Atualizar cache de assinatura - iniciando com status da assinatura
    updateSubscriptionCache(
      event.subscription.id, 
      event.subscription.status.toLowerCase(), 
      event.subscription.customer
    );
    
    // IMPORTANTE: Se o status for PENDING, registrar explicitamente que não está ativo
    if (INVALID_SUBSCRIPTION_STATUSES.includes(event.subscription.status.toUpperCase())) {
      console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} criada com status ${event.subscription.status} (não ativa)`);
    } else {
      console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} criada com status ${event.subscription.status}`);
    }
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar criação de assinatura:', error);
  }
}

// Processa atualização de assinatura
async function handleSubscriptionUpdated(event: AsaasWebhookEvent) {
  if (!event.subscription) return;
  
  try {
    // Atualizar cache de assinatura com o status atual
    updateSubscriptionCache(
      event.subscription.id, 
      event.subscription.status.toLowerCase(), 
      event.subscription.customer
    );
    
    // IMPORTANTE: Se o status mudou para ACTIVE, buscar info de pagamentos
    if (VALID_SUBSCRIPTION_STATUSES.includes(event.subscription.status.toUpperCase())) {
      try {
        // Buscar detalhes dos pagamentos para verificar se algum está confirmado
        const response = await fetch(`/api/asaas-find-subscription?subscriptionId=${event.subscription.id}&includePagamentos=true`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.payments && data.payments.length > 0) {
            // Verificar se há algum pagamento confirmado
            const confirmedPayment = data.payments.find(
              (p: any) => p.status === 'CONFIRMED' || p.status === 'RECEIVED'
            );
            
            if (confirmedPayment) {
              // Atualizar cache de pagamento
              updatePaymentCache(
                confirmedPayment.id,
                confirmedPayment.status,
                event.subscription.id
              );
            }
          }
        }
      } catch (error) {
        console.error('[ASAAS Webhook] Erro ao buscar pagamentos da assinatura:', error);
      }
    }
    
    // Log específico baseado no status
    if (INVALID_SUBSCRIPTION_STATUSES.includes(event.subscription.status.toUpperCase())) {
      console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} atualizada para status ${event.subscription.status} (não ativa)`);
    } else if (VALID_SUBSCRIPTION_STATUSES.includes(event.subscription.status.toUpperCase())) {
      console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} atualizada para status ACTIVE (ativa)`);
    } else {
      console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} atualizada para status ${event.subscription.status}`);
    }
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar atualização de assinatura:', error);
  }
}

// Processa cancelamento de assinatura
async function handleSubscriptionCancelled(event: AsaasWebhookEvent) {
  if (!event.subscription) return;
  
  try {
    // Atualizar cache de assinatura como cancelada
    updateSubscriptionCache(
      event.subscription.id, 
      'CANCELLED', 
      event.subscription.customer
    );
    
    console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} cancelada`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar cancelamento de assinatura:', error);
  }
} 