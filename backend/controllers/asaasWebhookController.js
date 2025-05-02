/**
 * Controlador para webhooks do Asaas
 * Implementação com idempotência seguindo as recomendações da Asaas
 */

const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

/**
 * Processa webhook do Asaas com idempotência
 * IMPORTANTE: Sempre retorna 200 para evitar que a Asaas pause a fila
 */
const processWebhook = async (req, res) => {
  try {
    console.log('[AsaasWebhook] Recebido novo evento:', req.body?.event);
    
    // Garantir que sempre retornará 200 mesmo em caso de erros
    // Evita que a Asaas pause a fila após 15 falhas consecutivas
    const respondSuccess = () => {
      res.status(200).json({ 
        received: true, 
        message: 'Webhook recebido com sucesso' 
      });
    };

    // Verificar se o corpo da requisição está presente
    if (!req.body || !req.body.event || !req.body.id) {
      console.error('[AsaasWebhook] Corpo da requisição inválido:', req.body);
      return respondSuccess(); // Retorna 200 mesmo com erro
    }
    
    const event = req.body.event;
    const eventId = req.body.id;
    
    // Obter acesso ao banco de dados
    const db = await getDb();
    
    // Verificar se este evento já foi processado (idempotência)
    const existingEvent = await db.collection('asaas_processed_webhooks')
      .findOne({ asaas_event_id: eventId });
    
    if (existingEvent) {
      console.log(`[AsaasWebhook] Evento ${eventId} já foi processado anteriormente em ${new Date(existingEvent.processed_at).toISOString()}`);
      return respondSuccess();
    }
    
    // Registrar o recebimento do evento antes do processamento
    // Isso garante que, mesmo que ocorra um erro no processamento,
    // o evento não será processado novamente
    await db.collection('asaas_processed_webhooks').insertOne({
      asaas_event_id: eventId,
      event_type: event,
      received_at: new Date(),
      processed_at: null,
      status: 'PROCESSING',
      payload: JSON.stringify(req.body)
    });
    
    console.log(`[AsaasWebhook] Evento ${eventId} registrado para processamento`);
    
    // Responder imediatamente com 200 para o Asaas
    // Isso evita timeouts e problemas na fila de webhooks
    respondSuccess();
    
    // Processar o evento de forma assíncrona
    // Mesmo que ocorra um erro aqui, o Asaas já recebeu o 200
    try {
      // Processar o evento com base no tipo
      switch (event) {
        // Eventos de pagamento
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_APPROVED':
          await processPaymentSuccess(req.body.payment, db);
          break;
        
        case 'PAYMENT_OVERDUE':
        case 'PAYMENT_CANCELED':
        case 'PAYMENT_REJECTED':
        case 'PAYMENT_CHARGEBACK_REQUESTED':
        case 'PAYMENT_CHARGEBACK_DISPUTE':
          await processPaymentFailure(req.body.payment, db);
          break;
        
        // Eventos de assinatura
        case 'SUBSCRIPTION_CREATED':
          await processSubscriptionCreated(req.body.subscription, db);
          break;
        
        case 'SUBSCRIPTION_ACTIVATED':
          await processSubscriptionActivated(req.body.subscription, db);
          break;
        
        case 'SUBSCRIPTION_EXPIRED':
        case 'SUBSCRIPTION_CANCELED':
        case 'SUBSCRIPTION_DELETED':
          await processSubscriptionEnded(req.body.subscription, db);
          break;
        
        default:
          console.log(`[AsaasWebhook] Evento não processado: ${event}`);
      }
      
      // Atualizar o status do evento para processado
      await db.collection('asaas_processed_webhooks').updateOne(
        { asaas_event_id: eventId },
        { 
          $set: { 
            status: 'PROCESSED',
            processed_at: new Date(),
            error: null
          } 
        }
      );
      
      console.log(`[AsaasWebhook] Evento ${eventId} processado com sucesso`);
    } catch (processingError) {
      console.error(`[AsaasWebhook] Erro ao processar evento ${eventId}:`, processingError);
      
      // Registrar o erro mas manter o evento como processado para evitar duplicidade
      await db.collection('asaas_processed_webhooks').updateOne(
        { asaas_event_id: eventId },
        { 
          $set: { 
            status: 'ERROR',
            processed_at: new Date(),
            error: processingError.message
          } 
        }
      );
    }
  } catch (error) {
    // Mesmo em caso de erro crítico, retornar 200
    console.error('[AsaasWebhook] Erro crítico ao processar webhook:', error);
    res.status(200).json({ 
      received: true, 
      processed: false,
      error: 'Erro interno ao processar o webhook'
    });
  }
};

/**
 * Processa evento de pagamento bem-sucedido
 * @param {Object} payment - Dados do pagamento
 * @param {Object} db - Conexão com o banco de dados
 */
async function processPaymentSuccess(payment, db) {
  if (!payment || !payment.customer) {
    console.error('[AsaasWebhook] Dados de pagamento inválidos');
    return;
  }
  
  const asaasCustomerId = payment.customer;
  const paymentId = payment.id;
  
  console.log(`[AsaasWebhook] Processando pagamento bem-sucedido: ${paymentId}`);
  
  // Atualizar o status da assinatura do usuário
  const result = await db.collection('users').updateOne(
    { asaasCustomerId: asaasCustomerId },
    { 
      $set: {
        'subscription.status': 'ACTIVE',
        'subscription.last_payment_date': new Date(),
        'subscription.payment_id': paymentId,
        'subscription.value': payment.value,
        'subscription.netValue': payment.netValue,
        'subscription.last_updated': new Date()
      }
    }
  );
  
  if (result.matchedCount === 0) {
    console.log(`[AsaasWebhook] Nenhum usuário encontrado com asaasCustomerId: ${asaasCustomerId}`);
    // Criar um registro de evento não processado para verificação posterior
    await db.collection('unprocessed_events').insertOne({
      type: 'PAYMENT_SUCCESS',
      customerId: asaasCustomerId,
      paymentId: paymentId,
      createdAt: new Date(),
      payload: JSON.stringify(payment)
    });
  } else {
    console.log(`[AsaasWebhook] Status de assinatura atualizado para usuário com asaasCustomerId: ${asaasCustomerId}`);
  }
}

/**
 * Processa evento de falha no pagamento
 * @param {Object} payment - Dados do pagamento
 * @param {Object} db - Conexão com o banco de dados
 */
async function processPaymentFailure(payment, db) {
  if (!payment || !payment.customer) {
    console.error('[AsaasWebhook] Dados de pagamento inválidos');
    return;
  }
  
  const asaasCustomerId = payment.customer;
  const paymentId = payment.id;
  
  console.log(`[AsaasWebhook] Processando falha de pagamento: ${paymentId}`);
  
  // Atualizar o status da assinatura do usuário
  const result = await db.collection('users').updateOne(
    { asaasCustomerId: asaasCustomerId },
    { 
      $set: {
        'subscription.status': 'INACTIVE',
        'subscription.last_status_update': new Date(),
        'subscription.payment_failure_reason': payment.status || 'unknown',
        'subscription.last_updated': new Date()
      }
    }
  );
  
  if (result.matchedCount === 0) {
    console.log(`[AsaasWebhook] Nenhum usuário encontrado com asaasCustomerId: ${asaasCustomerId}`);
    // Registrar para análise posterior
    await db.collection('unprocessed_events').insertOne({
      type: 'PAYMENT_FAILURE',
      customerId: asaasCustomerId,
      paymentId: paymentId,
      createdAt: new Date(),
      payload: JSON.stringify(payment)
    });
  } else {
    console.log(`[AsaasWebhook] Status de assinatura atualizado (falha) para usuário com asaasCustomerId: ${asaasCustomerId}`);
  }
}

/**
 * Processa evento de criação de assinatura
 * @param {Object} subscription - Dados da assinatura
 * @param {Object} db - Conexão com o banco de dados
 */
async function processSubscriptionCreated(subscription, db) {
  if (!subscription || !subscription.customer) {
    console.error('[AsaasWebhook] Dados de assinatura inválidos');
    return;
  }
  
  const asaasCustomerId = subscription.customer;
  const subscriptionId = subscription.id;
  
  console.log(`[AsaasWebhook] Processando criação de assinatura: ${subscriptionId}`);
  
  // Mapear o plano da assinatura conforme o ciclo de cobrança
  const planMap = {
    'MONTHLY': 'mensal',
    'QUARTERLY': 'trimestral',
    'YEARLY': 'anual',
    'WEEKLY': 'semanal',
    'BIWEEKLY': 'quinzenal',
    'SEMIANNUALLY': 'semestral',
    // Compatibilidade com valores em português
    'MENSAL': 'mensal',
    'TRIMESTRAL': 'trimestral',
    'ANUAL': 'anual'
  };
  
  // Determinar o tipo de plano com base no ciclo (billingCycle) ou tipo (billingType)
  const planCycle = subscription.billingCycle || subscription.billingType;
  const planType = planMap[planCycle] || 'mensal';
  
  // Mapear para o tipo interno de plano
  const planTierMap = {
    'mensal': 'BASIC',
    'trimestral': 'PRO',
    'anual': 'PREMIUM',
    'semanal': 'BASIC',
    'quinzenal': 'BASIC',
    'semestral': 'PRO'
  };
  
  const planTier = planTierMap[planType] || 'BASIC';
  
  // Atualizar o usuário com os dados da assinatura
  const result = await db.collection('users').updateOne(
    { asaasCustomerId: asaasCustomerId },
    { 
      $set: {
        'subscription.id': subscriptionId,
        'subscription.status': subscription.status,
        'subscription.plan_type': planType,
        'subscription.plan_tier': planTier,
        'subscription.created_at': new Date(),
        'subscription.next_due_date': subscription.nextDueDate,
        'subscription.value': subscription.value,
        'subscription.cycle': planCycle,
        'subscription.last_updated': new Date()
      }
    }
  );
  
  if (result.matchedCount === 0) {
    console.log(`[AsaasWebhook] Nenhum usuário encontrado com asaasCustomerId: ${asaasCustomerId}`);
    // Registrar para análise posterior
    await db.collection('unprocessed_events').insertOne({
      type: 'SUBSCRIPTION_CREATED',
      customerId: asaasCustomerId,
      subscriptionId: subscriptionId,
      createdAt: new Date(),
      payload: JSON.stringify(subscription)
    });
  } else {
    console.log(`[AsaasWebhook] Assinatura criada para usuário com asaasCustomerId: ${asaasCustomerId}`);
  }
}

/**
 * Processa evento de ativação de assinatura
 * @param {Object} subscription - Dados da assinatura
 * @param {Object} db - Conexão com o banco de dados
 */
async function processSubscriptionActivated(subscription, db) {
  if (!subscription || !subscription.customer) {
    console.error('[AsaasWebhook] Dados de assinatura inválidos');
    return;
  }
  
  const asaasCustomerId = subscription.customer;
  
  console.log(`[AsaasWebhook] Processando ativação de assinatura: ${subscription.id}`);
  
  // Atualizar o status da assinatura do usuário
  const result = await db.collection('users').updateOne(
    { asaasCustomerId: asaasCustomerId },
    { 
      $set: {
        'subscription.status': 'ACTIVE',
        'subscription.activated_at': new Date(),
        'subscription.last_updated': new Date()
      }
    }
  );
  
  if (result.matchedCount === 0) {
    console.log(`[AsaasWebhook] Nenhum usuário encontrado com asaasCustomerId: ${asaasCustomerId}`);
    // Registrar para análise posterior
    await db.collection('unprocessed_events').insertOne({
      type: 'SUBSCRIPTION_ACTIVATED',
      customerId: asaasCustomerId,
      subscriptionId: subscription.id,
      createdAt: new Date(),
      payload: JSON.stringify(subscription)
    });
  } else {
    console.log(`[AsaasWebhook] Assinatura ativada para usuário com asaasCustomerId: ${asaasCustomerId}`);
  }
}

/**
 * Processa evento de término de assinatura
 * @param {Object} subscription - Dados da assinatura
 * @param {Object} db - Conexão com o banco de dados
 */
async function processSubscriptionEnded(subscription, db) {
  if (!subscription || !subscription.customer) {
    console.error('[AsaasWebhook] Dados de assinatura inválidos');
    return;
  }
  
  const asaasCustomerId = subscription.customer;
  
  console.log(`[AsaasWebhook] Processando encerramento de assinatura: ${subscription.id}`);
  
  // Atualizar o status da assinatura do usuário
  const result = await db.collection('users').updateOne(
    { asaasCustomerId: asaasCustomerId },
    { 
      $set: {
        'subscription.status': 'INACTIVE',
        'subscription.ended_at': new Date(),
        'subscription.end_reason': subscription.status,
        'subscription.last_updated': new Date()
      }
    }
  );
  
  if (result.matchedCount === 0) {
    console.log(`[AsaasWebhook] Nenhum usuário encontrado com asaasCustomerId: ${asaasCustomerId}`);
    // Registrar para análise posterior
    await db.collection('unprocessed_events').insertOne({
      type: 'SUBSCRIPTION_ENDED',
      customerId: asaasCustomerId,
      subscriptionId: subscription.id,
      createdAt: new Date(),
      payload: JSON.stringify(subscription)
    });
  } else {
    console.log(`[AsaasWebhook] Assinatura encerrada para usuário com asaasCustomerId: ${asaasCustomerId}`);
  }
}

module.exports = {
  processWebhook
}; 