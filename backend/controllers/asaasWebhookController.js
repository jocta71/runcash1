/**
 * Controlador para webhooks do Asaas
 * Recebe e processa eventos de pagamento e assinatura
 */

const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

/**
 * Processa webhook do Asaas com idempotência
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 */
const processWebhook = async (req, res) => {
  try {
    const body = req.body;
    const eventId = body.id;
    
    if (!eventId) {
      console.error('Webhook sem ID de evento');
      return res.status(400).json({
        success: false,
        message: 'ID de evento ausente no webhook'
      });
    }
    
    const db = await getDb();
    
    // Verificar se este evento já foi processado (idempotência)
    const existingEvent = await db.collection('asaas_processed_webhooks')
      .findOne({ asaas_event_id: eventId });
    
    if (existingEvent) {
      console.log(`Evento ${eventId} já foi processado anteriormente`);
      return res.status(200).json({ received: true, processed: false, reason: 'already_processed' });
    }
    
    // Registrar o evento como processado antes de prosseguir
    await db.collection('asaas_processed_webhooks').insertOne({
      asaas_event_id: eventId,
      event_type: body.event,
      received_at: new Date(),
      payload: body
    });
    
    // Processar o evento com base no tipo
    switch (body.event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_APPROVED':
        await processPaymentSuccess(body.payment, db);
        break;
      
      case 'PAYMENT_OVERDUE':
      case 'PAYMENT_CANCELED':
      case 'PAYMENT_REJECTED':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
      case 'PAYMENT_CHARGEBACK_DISPUTE':
        await processPaymentFailure(body.payment, db);
        break;
      
      case 'SUBSCRIPTION_CREATED':
        await processSubscriptionCreated(body.subscription, db);
        break;
      
      case 'SUBSCRIPTION_ACTIVATED':
        await processSubscriptionActivated(body.subscription, db);
        break;
      
      case 'SUBSCRIPTION_EXPIRED':
      case 'SUBSCRIPTION_CANCELED':
      case 'SUBSCRIPTION_DELETED':
        await processSubscriptionEnded(body.subscription, db);
        break;
      
      default:
        console.log(`Evento não processado: ${body.event}`);
    }
    
    return res.status(200).json({ received: true, processed: true });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    
    // Mesmo em caso de erro, enviamos 200 para não reprocessar o webhook
    return res.status(200).json({ 
      received: true, 
      processed: false, 
      error: error.message 
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
    console.error('Dados de pagamento inválidos');
    return;
  }
  
  const asaasCustomerId = payment.customer;
  
  // Atualizar o status do usuário
  const result = await db.collection('users').updateOne(
    { asaasCustomerId: asaasCustomerId },
    { 
      $set: {
        'subscription.status': 'ACTIVE',
        'subscription.last_payment_date': new Date(),
        'subscription.payment_id': payment.id
      }
    }
  );
  
  if (result.modifiedCount === 0) {
    console.log(`Nenhum usuário encontrado com asaasCustomerId: ${asaasCustomerId}`);
  } else {
    console.log(`Status de assinatura atualizado para usuário com asaasCustomerId: ${asaasCustomerId}`);
  }
}

/**
 * Processa evento de falha no pagamento
 * @param {Object} payment - Dados do pagamento
 * @param {Object} db - Conexão com o banco de dados
 */
async function processPaymentFailure(payment, db) {
  if (!payment || !payment.customer) {
    console.error('Dados de pagamento inválidos');
    return;
  }
  
  const asaasCustomerId = payment.customer;
  
  // Atualizar o status do usuário
  const result = await db.collection('users').updateOne(
    { asaasCustomerId: asaasCustomerId },
    { 
      $set: {
        'subscription.status': 'INACTIVE',
        'subscription.last_status_update': new Date(),
        'subscription.payment_failure_reason': payment.status || 'unknown'
      }
    }
  );
  
  if (result.modifiedCount === 0) {
    console.log(`Nenhum usuário encontrado com asaasCustomerId: ${asaasCustomerId}`);
  } else {
    console.log(`Status de assinatura atualizado (falha) para usuário com asaasCustomerId: ${asaasCustomerId}`);
  }
}

/**
 * Processa evento de criação de assinatura
 * @param {Object} subscription - Dados da assinatura
 * @param {Object} db - Conexão com o banco de dados
 */
async function processSubscriptionCreated(subscription, db) {
  if (!subscription || !subscription.customer) {
    console.error('Dados de assinatura inválidos');
    return;
  }
  
  const asaasCustomerId = subscription.customer;
  
  // Mapear o plano da assinatura
  const planMap = {
    'mensal': 'BASIC',
    'trimestral': 'PRO',
    'anual': 'PREMIUM',
    // Adicione mais mapeamentos conforme necessário
  };
  
  const planType = planMap[subscription.billingType] || 'BASIC';
  
  // Atualizar o usuário com os dados da assinatura
  const result = await db.collection('users').updateOne(
    { asaasCustomerId: asaasCustomerId },
    { 
      $set: {
        'subscription.id': subscription.id,
        'subscription.status': subscription.status,
        'subscription.plan_type': planType,
        'subscription.created_at': new Date(),
        'subscription.next_due_date': subscription.nextDueDate,
        'subscription.value': subscription.value
      }
    }
  );
  
  if (result.modifiedCount === 0) {
    console.log(`Nenhum usuário encontrado com asaasCustomerId: ${asaasCustomerId}`);
  } else {
    console.log(`Assinatura criada para usuário com asaasCustomerId: ${asaasCustomerId}`);
  }
}

/**
 * Processa evento de ativação de assinatura
 * @param {Object} subscription - Dados da assinatura
 * @param {Object} db - Conexão com o banco de dados
 */
async function processSubscriptionActivated(subscription, db) {
  if (!subscription || !subscription.customer) {
    console.error('Dados de assinatura inválidos');
    return;
  }
  
  const asaasCustomerId = subscription.customer;
  
  // Atualizar o status da assinatura do usuário
  const result = await db.collection('users').updateOne(
    { asaasCustomerId: asaasCustomerId },
    { 
      $set: {
        'subscription.status': 'ACTIVE',
        'subscription.activated_at': new Date(),
      }
    }
  );
  
  if (result.modifiedCount === 0) {
    console.log(`Nenhum usuário encontrado com asaasCustomerId: ${asaasCustomerId}`);
  } else {
    console.log(`Assinatura ativada para usuário com asaasCustomerId: ${asaasCustomerId}`);
  }
}

/**
 * Processa evento de término de assinatura
 * @param {Object} subscription - Dados da assinatura
 * @param {Object} db - Conexão com o banco de dados
 */
async function processSubscriptionEnded(subscription, db) {
  if (!subscription || !subscription.customer) {
    console.error('Dados de assinatura inválidos');
    return;
  }
  
  const asaasCustomerId = subscription.customer;
  
  // Atualizar o status da assinatura do usuário
  const result = await db.collection('users').updateOne(
    { asaasCustomerId: asaasCustomerId },
    { 
      $set: {
        'subscription.status': 'INACTIVE',
        'subscription.ended_at': new Date(),
        'subscription.end_reason': subscription.status
      }
    }
  );
  
  if (result.modifiedCount === 0) {
    console.log(`Nenhum usuário encontrado com asaasCustomerId: ${asaasCustomerId}`);
  } else {
    console.log(`Assinatura encerrada para usuário com asaasCustomerId: ${asaasCustomerId}`);
  }
}

module.exports = {
  processWebhook
}; 