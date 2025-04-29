// Usando interfaces genéricas em vez de Next.js específicas
interface ApiRequest {
  method: string;
  body: any;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: any) => any;
  end: () => void;
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

// Funções auxiliares para manipulação de localStorage
// No ambiente serverless, precisamos simular o localStorage
let memoryStorage: Record<string, any> = {};

function getLocalStorage(key: string): any {
  // No lado do servidor, usamos memória
  if (typeof window === 'undefined') {
    return memoryStorage[key] ? JSON.parse(memoryStorage[key]) : null;
  }
  // No lado do cliente, usamos localStorage
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Erro ao ler ${key} do localStorage:`, error);
    return null;
  }
}

function setLocalStorage(key: string, value: any): void {
  // No lado do servidor, usamos memória
  if (typeof window === 'undefined') {
    memoryStorage[key] = JSON.stringify(value);
    return;
  }
  // No lado do cliente, usamos localStorage
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Erro ao salvar ${key} no localStorage:`, error);
  }
}

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
        await handlePaymentConfirmed(event);
        break;
      case 'PAYMENT_RECEIVED':
        await handlePaymentReceived(event);
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

// Registra o evento para histórico e debug
function recordWebhookEvent(event: AsaasWebhookEvent) {
  try {
    // Tentar obter histórico existente
    const historyStr = localStorage.getItem('asaas_webhook_history');
    const history = historyStr ? JSON.parse(historyStr) : [];
    
    // Adicionar novo evento ao histórico
    history.push({
      event: event.event,
      paymentId: event.payment?.id,
      subscriptionId: event.subscription?.id || event.payment?.subscription,
      customerId: event.payment?.customer || event.subscription?.customer,
      status: event.payment?.status || event.subscription?.status,
      timestamp: new Date().toISOString()
    });
    
    // Limitar histórico a 50 eventos
    const limitedHistory = history.slice(-50);
    
    // Salvar histórico atualizado
    localStorage.setItem('asaas_webhook_history', JSON.stringify(limitedHistory));
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao registrar evento:', error);
  }
}

// Gerencia pagamento confirmado
function handlePaymentConfirmed(event: AsaasWebhookEvent) {
  try {
    console.log(`[ASAAS Webhook] Pagamento confirmado: ${event.payment.id}`);
    
    // Atualizar cache de pagamento
    updatePaymentCache(event.payment.id, 'confirmed', event.payment.customer);
    
    // Se o pagamento estiver associado a uma assinatura
    if (event.payment.subscription) {
      console.log(`[ASAAS Webhook] Pagamento ${event.payment.id} associado à assinatura ${event.payment.subscription}`);
      
      // Atualizar cache de assinatura com pagamento confirmado = true
      updateSubscriptionCache(
        event.payment.customer,
        event.payment.subscription, 
        'active', 
        true // Explicitamente marcar pagamento como confirmado
      );
    }
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar pagamento confirmado:', error);
  }
}

// Gerencia pagamento recebido
function handlePaymentReceived(event: AsaasWebhookEvent) {
  try {
    console.log(`[ASAAS Webhook] Pagamento recebido: ${event.payment.id}`);
    
    // Atualizar cache de pagamento
    updatePaymentCache(event.payment.id, 'received', event.payment.customer);
    
    // Se o pagamento estiver associado a uma assinatura
    if (event.payment.subscription) {
      console.log(`[ASAAS Webhook] Pagamento ${event.payment.id} recebido para assinatura ${event.payment.subscription}`);
      
      // Atualizar cache de assinatura com pagamento confirmado = true
      updateSubscriptionCache(
        event.payment.customer,
        event.payment.subscription, 
        'active', 
        true // Marcar pagamento como confirmado
      );
    }
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar pagamento recebido:', error);
  }
}

// Processa pagamento atrasado
async function handlePaymentOverdue(event: AsaasWebhookEvent) {
  if (!event.payment) return;
  
  try {
    // Se esse pagamento for de uma assinatura, atualizar cache da assinatura
    if (event.payment.subscription) {
      // Atualizar cache de assinatura
      updateSubscriptionCache(
        event.payment.customer,
        event.payment.subscription, 
        'inactive', 
        false // Explicitamente marcar pagamento como não confirmado
      );
    }
    
    // Atualizar status de pagamento
    updatePaymentCache(event.payment.id, 'overdue', event.payment.customer);
    
    console.log(`[ASAAS Webhook] Pagamento ${event.payment.id} atrasado para assinatura ${event.payment.subscription}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar pagamento atrasado:', error);
  }
}

// Processa criação de assinatura
async function handleSubscriptionCreated(event: AsaasWebhookEvent) {
  if (!event.subscription) return;
  
  try {
    // Atualizar cache de assinatura - iniciando com status da assinatura
    updateSubscriptionCache(
      event.subscription.customer,
      event.subscription.id, 
      event.subscription.status.toLowerCase(), 
      false // Explicitamente marcar pagamento como não confirmado
    );
    
    console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} criada com status ${event.subscription.status}`);
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
      event.subscription.customer,
      event.subscription.id, 
      event.subscription.status.toLowerCase(), 
      false // Explicitamente marcar pagamento como não confirmado
    );
    
    console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} atualizada para status ${event.subscription.status}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar atualização de assinatura:', error);
  }
}

// Processa cancelamento de assinatura
async function handleSubscriptionCancelled(event: AsaasWebhookEvent) {
  if (!event.subscription) return;
  
  try {
    // Atualizar cache de assinatura para inativa
    updateSubscriptionCache(
      event.subscription.customer,
      event.subscription.id, 
      'inactive', 
      false // Explicitamente marcar pagamento como não confirmado
    );
    
    console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} cancelada`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar cancelamento de assinatura:', error);
  }
}

// Atualiza o cache de assinatura
function updateSubscriptionCache(
  customerId: string,
  subscriptionId: string,
  status: string,
  paymentConfirmed: boolean = false
) {
  console.log(`Atualizando cache de assinatura: Cliente ${customerId}, Assinatura ${subscriptionId}, Status ${status}, Pagamento Confirmado: ${paymentConfirmed}`);
  
  // Obtém o cache atual ou cria um novo
  const subscriptionCache = getLocalStorage('asaas_subscription_cache') || {};
  
  // Atualiza a entrada para este cliente
  subscriptionCache[customerId] = {
    id: subscriptionId,
    status: status,
    updatedAt: new Date().toISOString(),
    hasConfirmedPayment: paymentConfirmed
  };
  
  // Salva o cache atualizado
  setLocalStorage('asaas_subscription_cache', subscriptionCache);
}

// Atualiza o cache de pagamento
function updatePaymentCache(
  paymentId: string, 
  status: string, 
  customerId: string
) {
  try {
    const cacheData = {
      id: paymentId,
      status: status,
      customerId: customerId,
      updatedAt: new Date().toISOString(),
      timestamp: Date.now()
    };
    
    // Salvar no cache específico do pagamento
    localStorage.setItem(`asaas_payment_${paymentId}`, JSON.stringify(cacheData));
    
    // Atualizar cache global de pagamentos do usuário
    const userPaymentsStr = localStorage.getItem(`asaas_user_payments_${customerId}`);
    const userPayments = userPaymentsStr ? JSON.parse(userPaymentsStr) : {};
    
    userPayments[paymentId] = cacheData;
    localStorage.setItem(`asaas_user_payments_${customerId}`, JSON.stringify(userPayments));
    
    console.log(`[ASAAS Webhook] Cache de pagamento ${paymentId} atualizado para status ${status}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao atualizar cache de pagamento:', error);
  }
} 