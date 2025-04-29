// Usando interfaces genéricas em vez de Next.js específicas
interface ApiRequest {
  method: string;
  body: any;
  headers: {
    [key: string]: string | string[] | undefined;
  };
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
  id?: string; // ID do evento
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
  console.log(`[ASAAS Webhook] Recebida requisição com método: ${req.method}`);
  console.log(`[ASAAS Webhook] Headers: ${JSON.stringify(req.headers)}`);

  // Registrar a tentativa de webhook, independente do método
  recordWebhookAttempt(req);

  // Apenas permitir método POST para webhooks
  if (req.method !== 'POST') {
    console.log(`[ASAAS Webhook] Método não permitido: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verificar se o corpo é válido
    if (!req.body || typeof req.body !== 'object') {
      console.error('[ASAAS Webhook] Corpo da requisição inválido ou ausente');
      // Ainda retornar 200 para não pausar a fila
      return res.status(200).json({ 
        success: false, 
        error: 'Corpo da requisição inválido ou ausente'
      });
    }

    const event = req.body as AsaasWebhookEvent;
    const eventId = event.id || 'sem_id';
    console.log(`[ASAAS Webhook] Evento recebido: ${event.event} (ID: ${eventId})`);
    console.log(`[ASAAS Webhook] Conteúdo: ${JSON.stringify(req.body)}`);

    // Registrar evento para histórico
    recordWebhookEvent(event);

    // Validar se não é uma duplicata que já processamos
    if (isDuplicateEvent(eventId)) {
      console.log(`[ASAAS Webhook] Evento duplicado detectado, ID: ${eventId}`);
      return res.status(200).json({ 
        success: true, 
        message: 'Evento já processado anteriormente'
      });
    }

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
      default:
        console.log(`[ASAAS Webhook] Evento não processado: ${event.event}`);
    }

    // Registrar processamento bem-sucedido
    if (eventId !== 'sem_id') {
      markEventAsProcessed(eventId);
    }

    // Responder com sucesso (status 200) para confirmar recebimento
    return res.status(200).json({ 
      success: true, 
      message: 'Webhook processado com sucesso',
      eventId: eventId 
    });
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar webhook:', error);
    // Ainda retornar 200 para não bloquear a fila de webhooks da Asaas
    return res.status(200).json({ 
      success: false, 
      error: 'Erro interno, mas recebido'
    });
  }
}

// Verifica se um evento já foi processado antes (idempotência)
function isDuplicateEvent(eventId: string): boolean {
  if (eventId === 'sem_id') return false;
  
  const processedEvents = getLocalStorage('asaas_processed_events') || {};
  return !!processedEvents[eventId];
}

// Marca um evento como processado
function markEventAsProcessed(eventId: string): void {
  const processedEvents = getLocalStorage('asaas_processed_events') || {};
  processedEvents[eventId] = {
    timestamp: new Date().toISOString(),
    processed: true
  };
  setLocalStorage('asaas_processed_events', processedEvents);
}

// Registra qualquer tentativa de webhook, mesmo inválida
function recordWebhookAttempt(req: ApiRequest) {
  try {
    const attempts = getLocalStorage('asaas_webhook_attempts') || [];
    
    attempts.push({
      method: req.method,
      path: '/api/asaas-webhook',
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
    
    // Limitar a 20 tentativas
    const limitedAttempts = attempts.slice(-20);
    setLocalStorage('asaas_webhook_attempts', limitedAttempts);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao registrar tentativa:', error);
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
      eventId: event.id || 'sem_id',
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
    if (!event.payment) {
      console.error('[ASAAS Webhook] Evento PAYMENT_CONFIRMED sem dados de pagamento');
      return;
    }
    
    console.log(`[ASAAS Webhook] Pagamento confirmado: ${event.payment.id}`);
    console.log(`[ASAAS Webhook] Detalhes do pagamento: ${JSON.stringify(event.payment)}`);
    
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
      
      // Verificar o cache após a atualização
      verifySubscriptionCache(event.payment.customer);
    }
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar pagamento confirmado:', error);
  }
}

// Gerencia pagamento recebido
function handlePaymentReceived(event: AsaasWebhookEvent) {
  try {
    if (!event.payment) {
      console.error('[ASAAS Webhook] Evento PAYMENT_RECEIVED sem dados de pagamento');
      return;
    }
    
    console.log(`[ASAAS Webhook] Pagamento recebido: ${event.payment.id}`);
    console.log(`[ASAAS Webhook] Detalhes do pagamento: ${JSON.stringify(event.payment)}`);
    
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
      
      // Verificar o cache após a atualização
      verifySubscriptionCache(event.payment.customer);
    }
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar pagamento recebido:', error);
  }
}

// Processa pagamento atrasado
async function handlePaymentOverdue(event: AsaasWebhookEvent) {
  if (!event.payment) {
    console.error('[ASAAS Webhook] Evento PAYMENT_OVERDUE sem dados de pagamento');
    return;
  }
  
  try {
    console.log(`[ASAAS Webhook] Pagamento atrasado: ${event.payment.id}`);
    console.log(`[ASAAS Webhook] Detalhes do pagamento: ${JSON.stringify(event.payment)}`);
    
    // Se esse pagamento for de uma assinatura, atualizar cache da assinatura
    if (event.payment.subscription) {
      // Atualizar cache de assinatura
      updateSubscriptionCache(
        event.payment.customer,
        event.payment.subscription, 
        'inactive', 
        false // Explicitamente marcar pagamento como não confirmado
      );
      
      // Verificar o cache após a atualização
      verifySubscriptionCache(event.payment.customer);
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
  if (!event.subscription) {
    console.error('[ASAAS Webhook] Evento SUBSCRIPTION_CREATED sem dados de assinatura');
    return;
  }
  
  try {
    console.log(`[ASAAS Webhook] Assinatura criada: ${event.subscription.id}`);
    console.log(`[ASAAS Webhook] Detalhes da assinatura: ${JSON.stringify(event.subscription)}`);
    
    // Atualizar cache de assinatura - iniciando com status da assinatura
    updateSubscriptionCache(
      event.subscription.customer,
      event.subscription.id, 
      event.subscription.status.toLowerCase(), 
      false // Explicitamente marcar pagamento como não confirmado
    );
    
    // Verificar o cache após a atualização
    verifySubscriptionCache(event.subscription.customer);
    
    console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} criada com status ${event.subscription.status}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar criação de assinatura:', error);
  }
}

// Processa atualização de assinatura
async function handleSubscriptionUpdated(event: AsaasWebhookEvent) {
  if (!event.subscription) {
    console.error('[ASAAS Webhook] Evento SUBSCRIPTION_UPDATED sem dados de assinatura');
    return;
  }
  
  try {
    console.log(`[ASAAS Webhook] Assinatura atualizada: ${event.subscription.id}`);
    console.log(`[ASAAS Webhook] Detalhes da assinatura: ${JSON.stringify(event.subscription)}`);
    
    // Atualizar cache de assinatura com o status atual
    updateSubscriptionCache(
      event.subscription.customer,
      event.subscription.id, 
      event.subscription.status.toLowerCase(), 
      false // Explicitamente marcar pagamento como não confirmado
    );
    
    // Verificar o cache após a atualização
    verifySubscriptionCache(event.subscription.customer);
    
    console.log(`[ASAAS Webhook] Assinatura ${event.subscription.id} atualizada para status ${event.subscription.status}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao processar atualização de assinatura:', error);
  }
}

// Processa cancelamento de assinatura
async function handleSubscriptionCancelled(event: AsaasWebhookEvent) {
  if (!event.subscription) {
    console.error('[ASAAS Webhook] Evento SUBSCRIPTION_CANCELLED sem dados de assinatura');
    return;
  }
  
  try {
    console.log(`[ASAAS Webhook] Assinatura cancelada: ${event.subscription.id}`);
    console.log(`[ASAAS Webhook] Detalhes da assinatura: ${JSON.stringify(event.subscription)}`);
    
    // Atualizar cache de assinatura para inativa
    updateSubscriptionCache(
      event.subscription.customer,
      event.subscription.id, 
      'inactive', 
      false // Explicitamente marcar pagamento como não confirmado
    );
    
    // Verificar o cache após a atualização
    verifySubscriptionCache(event.subscription.customer);
    
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
  console.log(`[ASAAS Webhook] Atualizando cache de assinatura: Cliente ${customerId}, Assinatura ${subscriptionId}, Status ${status}, Pagamento Confirmado: ${paymentConfirmed}`);
  
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
  
  console.log(`[ASAAS Webhook] Cache de assinatura atualizado para cliente ${customerId}`);
}

// Verifica se o cache foi atualizado corretamente
function verifySubscriptionCache(customerId: string) {
  try {
    const subscriptionCache = getLocalStorage('asaas_subscription_cache') || {};
    const customerCache = subscriptionCache[customerId];
    
    if (customerCache) {
      console.log(`[ASAAS Webhook] Verificação de cache: ${JSON.stringify(customerCache)}`);
    } else {
      console.error(`[ASAAS Webhook] ERRO: Cache não encontrado para cliente ${customerId} após atualização`);
    }
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao verificar cache de assinatura:', error);
  }
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
    setLocalStorage(`asaas_payment_${paymentId}`, cacheData);
    
    // Atualizar cache global de pagamentos do usuário
    const userPayments = getLocalStorage(`asaas_user_payments_${customerId}`) || {};
    
    userPayments[paymentId] = cacheData;
    setLocalStorage(`asaas_user_payments_${customerId}`, userPayments);
    
    console.log(`[ASAAS Webhook] Cache de pagamento ${paymentId} atualizado para status ${status}`);
  } catch (error) {
    console.error('[ASAAS Webhook] Erro ao atualizar cache de pagamento:', error);
  }
} 