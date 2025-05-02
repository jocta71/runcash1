/**
 * Controlador para processar webhooks do Asaas
 * Implementa idempotência e processamento de eventos de pagamento/assinatura
 */

const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

/**
 * Processa os webhooks recebidos do Asaas
 * Implementa idempotência para evitar processamento duplicado
 */
const processWebhook = async (req, res) => {
  try {
    const body = req.body;
    const eventId = body.id;
    
    // Validação básica do webhook
    if (!eventId || !body.event) {
      return res.status(400).json({
        success: false,
        message: 'Webhook inválido: ID ou evento ausente'
      });
    }
    
    console.log(`[AsaasWebhook] Recebido evento: ${body.event}, ID: ${eventId}`);
    
    const db = await getDb();
    
    // Verificar se o evento já foi processado (idempotência)
    const eventExists = await db.collection('asaas_processed_webhooks').findOne({
      asaas_evt_id: eventId
    });
    
    if (eventExists) {
      console.log(`[AsaasWebhook] Evento ${eventId} já foi processado anteriormente.`);
      return res.json({
        success: true,
        message: 'Evento já processado anteriormente',
        received: true
      });
    }

    // Processar o evento conforme seu tipo
    switch (body.event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        await handlePaymentConfirmed(body, db);
        break;
        
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(body, db);
        break;
        
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_CONFIRMED':
        await handlePaymentRefunded(body, db);
        break;
        
      case 'SUBSCRIPTION_CREATED':
        await handleSubscriptionCreated(body, db);
        break;
        
      case 'SUBSCRIPTION_UPDATED':
        await handleSubscriptionUpdated(body, db);
        break;
        
      case 'SUBSCRIPTION_CANCELLED':
        await handleSubscriptionCancelled(body, db);
        break;
        
      case 'SUBSCRIPTION_DELETED':
        await handleSubscriptionDeleted(body, db);
        break;
        
      default:
        console.log(`[AsaasWebhook] Evento não tratado: ${body.event}`);
    }
    
    // Registrar que o evento foi processado (garantir idempotência)
    await db.collection('asaas_processed_webhooks').insertOne({
      asaas_evt_id: eventId,
      event_type: body.event,
      processed_at: new Date(),
      raw_payload: JSON.stringify(body)
    });
    
    return res.json({
      success: true,
      message: 'Webhook processado com sucesso',
      received: true
    });
  } catch (error) {
    console.error('[AsaasWebhook] Erro ao processar webhook:', error);
    
    // Mesmo em caso de erro, retornar 200 para o Asaas não reenviar
    // o erro interno será registrado para debug
    return res.status(200).json({
      success: false,
      message: 'Erro ao processar webhook, mas recebido',
      received: true,
      error: error.message
    });
  }
};

/**
 * Trata evento de pagamento confirmado
 * Atualiza o status da assinatura do usuário
 */
async function handlePaymentConfirmed(body, db) {
  try {
    const payment = body.payment;
    
    // Verificar se o pagamento está relacionado a uma assinatura
    if (!payment.subscription) {
      console.log('[AsaasWebhook] Pagamento não está associado a uma assinatura');
      return;
    }
    
    // Buscar o cliente associado ao pagamento
    const customerId = payment.customer;
    
    // Buscar usuário pelo customerId do Asaas
    const user = await db.collection('users').findOne({
      asaas_customer_id: customerId
    });
    
    if (!user) {
      console.log(`[AsaasWebhook] Usuário não encontrado para customer_id: ${customerId}`);
      return;
    }
    
    // Determinar data de validade da assinatura
    const validUntil = new Date(payment.dueDate);
    // Adicionar um mês à data de validade (ou o período específico do plano)
    validUntil.setMonth(validUntil.getMonth() + 1);
    
    // Determinar o tipo de plano com base na descrição ou valor
    let planType = 'BASIC'; // Padrão
    
    if (payment.description && payment.description.includes('PRO')) {
      planType = 'PRO';
    } else if (payment.description && payment.description.includes('PREMIUM')) {
      planType = 'PREMIUM';
    } else if (payment.value >= 99.90) {
      planType = 'PREMIUM';
    } else if (payment.value >= 49.90) {
      planType = 'PRO';
    }
    
    // Atualizar ou criar registro de assinatura
    await db.collection('user_subscriptions').updateOne(
      { user_id: user._id.toString() },
      {
        $set: {
          asaas_subscription_id: payment.subscription,
          asaas_customer_id: customerId,
          status: 'ACTIVE',
          plan_type: planType,
          valid_until: validUntil,
          last_payment_date: new Date(payment.confirmedDate || payment.receivedDate),
          last_payment_id: payment.id,
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log(`[AsaasWebhook] Assinatura ativada para usuário: ${user._id}, plano: ${planType}`);
  } catch (error) {
    console.error('[AsaasWebhook] Erro ao processar pagamento confirmado:', error);
    throw error;
  }
}

/**
 * Trata evento de pagamento atrasado
 */
async function handlePaymentOverdue(body, db) {
  try {
    const payment = body.payment;
    
    // Verificar se o pagamento está relacionado a uma assinatura
    if (!payment.subscription) {
      console.log('[AsaasWebhook] Pagamento não está associado a uma assinatura');
      return;
    }
    
    // Buscar o cliente associado ao pagamento
    const customerId = payment.customer;
    
    // Buscar usuário pelo customerId do Asaas
    const user = await db.collection('users').findOne({
      asaas_customer_id: customerId
    });
    
    if (!user) {
      console.log(`[AsaasWebhook] Usuário não encontrado para customer_id: ${customerId}`);
      return;
    }
    
    // Atualizar status da assinatura para "OVERDUE"
    await db.collection('user_subscriptions').updateOne(
      { user_id: user._id.toString() },
      {
        $set: {
          status: 'OVERDUE',
          updated_at: new Date()
        }
      }
    );
    
    console.log(`[AsaasWebhook] Assinatura marcada como atrasada para usuário: ${user._id}`);
  } catch (error) {
    console.error('[AsaasWebhook] Erro ao processar pagamento atrasado:', error);
    throw error;
  }
}

/**
 * Trata evento de pagamento reembolsado
 */
async function handlePaymentRefunded(body, db) {
  try {
    const payment = body.payment;
    
    // Verificar se o pagamento está relacionado a uma assinatura
    if (!payment.subscription) {
      console.log('[AsaasWebhook] Pagamento não está associado a uma assinatura');
      return;
    }
    
    // Buscar o cliente associado ao pagamento
    const customerId = payment.customer;
    
    // Buscar usuário pelo customerId do Asaas
    const user = await db.collection('users').findOne({
      asaas_customer_id: customerId
    });
    
    if (!user) {
      console.log(`[AsaasWebhook] Usuário não encontrado para customer_id: ${customerId}`);
      return;
    }
    
    // Atualizar status da assinatura para "REFUNDED"
    await db.collection('user_subscriptions').updateOne(
      { user_id: user._id.toString() },
      {
        $set: {
          status: 'REFUNDED',
          updated_at: new Date()
        }
      }
    );
    
    console.log(`[AsaasWebhook] Pagamento reembolsado para usuário: ${user._id}`);
  } catch (error) {
    console.error('[AsaasWebhook] Erro ao processar reembolso:', error);
    throw error;
  }
}

/**
 * Trata evento de assinatura criada
 */
async function handleSubscriptionCreated(body, db) {
  try {
    const subscription = body.subscription;
    const customerId = subscription.customer;
    
    // Buscar usuário pelo customerId do Asaas
    const user = await db.collection('users').findOne({
      asaas_customer_id: customerId
    });
    
    if (!user) {
      console.log(`[AsaasWebhook] Usuário não encontrado para customer_id: ${customerId}`);
      return;
    }
    
    // Determinar o tipo de plano com base na descrição ou valor
    let planType = 'BASIC'; // Padrão
    
    if (subscription.description && subscription.description.includes('PRO')) {
      planType = 'PRO';
    } else if (subscription.description && subscription.description.includes('PREMIUM')) {
      planType = 'PREMIUM';
    } else if (subscription.value >= 99.90) {
      planType = 'PREMIUM';
    } else if (subscription.value >= 49.90) {
      planType = 'PRO';
    }
    
    // Atualizar ou criar registro de assinatura
    await db.collection('user_subscriptions').updateOne(
      { user_id: user._id.toString() },
      {
        $set: {
          asaas_subscription_id: subscription.id,
          asaas_customer_id: customerId,
          status: subscription.status,
          plan_type: planType,
          next_due_date: new Date(subscription.nextDueDate),
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log(`[AsaasWebhook] Assinatura criada para usuário: ${user._id}, plano: ${planType}`);
  } catch (error) {
    console.error('[AsaasWebhook] Erro ao processar criação de assinatura:', error);
    throw error;
  }
}

/**
 * Trata evento de assinatura atualizada
 */
async function handleSubscriptionUpdated(body, db) {
  try {
    const subscription = body.subscription;
    const customerId = subscription.customer;
    
    // Buscar usuário pelo customerId do Asaas
    const user = await db.collection('users').findOne({
      asaas_customer_id: customerId
    });
    
    if (!user) {
      console.log(`[AsaasWebhook] Usuário não encontrado para customer_id: ${customerId}`);
      return;
    }
    
    // Determinar o tipo de plano com base na descrição ou valor
    let planType = 'BASIC'; // Padrão
    
    if (subscription.description && subscription.description.includes('PRO')) {
      planType = 'PRO';
    } else if (subscription.description && subscription.description.includes('PREMIUM')) {
      planType = 'PREMIUM';
    } else if (subscription.value >= 99.90) {
      planType = 'PREMIUM';
    } else if (subscription.value >= 49.90) {
      planType = 'PRO';
    }
    
    // Atualizar registro de assinatura
    await db.collection('user_subscriptions').updateOne(
      { user_id: user._id.toString() },
      {
        $set: {
          asaas_subscription_id: subscription.id,
          status: subscription.status,
          plan_type: planType,
          next_due_date: new Date(subscription.nextDueDate),
          updated_at: new Date()
        }
      }
    );
    
    console.log(`[AsaasWebhook] Assinatura atualizada para usuário: ${user._id}, status: ${subscription.status}`);
  } catch (error) {
    console.error('[AsaasWebhook] Erro ao processar atualização de assinatura:', error);
    throw error;
  }
}

/**
 * Trata evento de assinatura cancelada
 */
async function handleSubscriptionCancelled(body, db) {
  try {
    const subscription = body.subscription;
    const customerId = subscription.customer;
    
    // Buscar usuário pelo customerId do Asaas
    const user = await db.collection('users').findOne({
      asaas_customer_id: customerId
    });
    
    if (!user) {
      console.log(`[AsaasWebhook] Usuário não encontrado para customer_id: ${customerId}`);
      return;
    }
    
    // Atualizar status da assinatura para "CANCELLED"
    await db.collection('user_subscriptions').updateOne(
      { user_id: user._id.toString() },
      {
        $set: {
          status: 'CANCELLED',
          cancelled_at: new Date(),
          updated_at: new Date()
        }
      }
    );
    
    console.log(`[AsaasWebhook] Assinatura cancelada para usuário: ${user._id}`);
  } catch (error) {
    console.error('[AsaasWebhook] Erro ao processar cancelamento de assinatura:', error);
    throw error;
  }
}

/**
 * Trata evento de assinatura excluída
 */
async function handleSubscriptionDeleted(body, db) {
  try {
    const subscription = body.subscription;
    const customerId = subscription.customer;
    
    // Buscar usuário pelo customerId do Asaas
    const user = await db.collection('users').findOne({
      asaas_customer_id: customerId
    });
    
    if (!user) {
      console.log(`[AsaasWebhook] Usuário não encontrado para customer_id: ${customerId}`);
      return;
    }
    
    // Atualizar status da assinatura para "DELETED"
    await db.collection('user_subscriptions').updateOne(
      { user_id: user._id.toString() },
      {
        $set: {
          status: 'DELETED',
          deleted_at: new Date(),
          updated_at: new Date()
        }
      }
    );
    
    console.log(`[AsaasWebhook] Assinatura excluída para usuário: ${user._id}`);
  } catch (error) {
    console.error('[AsaasWebhook] Erro ao processar exclusão de assinatura:', error);
    throw error;
  }
}

module.exports = {
  processWebhook
}; 