/**
 * Middleware para processar webhooks do Asaas
 * Atualiza as coleções subscriptions e userSubscriptions
 */
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const router = express.Router();
const crypto = require('crypto');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Chave para verificação da assinatura do webhook (opcional)
const WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET || '';

/**
 * Middleware para verificar a assinatura do webhook (segurança)
 */
function verifyWebhookSignature(req, res, next) {
  if (!WEBHOOK_SECRET) {
    // Se a chave não estiver configurada, pular verificação
    return next();
  }

  const signature = req.headers['asaas-signature'] || '';
  const payload = JSON.stringify(req.body);
  
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (hmac !== signature) {
    console.log('[AsaasWebhook] Assinatura inválida do webhook');
    return res.status(403).json({ error: 'Assinatura inválida' });
  }
  
  next();
}

/**
 * Rota principal para receber webhooks do Asaas
 */
router.post('/', verifyWebhookSignature, async (req, res) => {
  const event = req.body.event;
  const requestId = Math.random().toString(36).substring(2, 15);
  
  console.log(`[AsaasWebhook ${requestId}] Recebido webhook: ${event}`);
  
  try {
    let result;
    
    // Processar diferentes eventos
    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_APPROVED':
        result = await handlePaymentConfirmed(req.body);
        break;
        
      case 'PAYMENT_OVERDUE':
        result = await handlePaymentOverdue(req.body);
        break;
      
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK':
        result = await handlePaymentCancelled(req.body);
        break;
      
      case 'SUBSCRIPTION_CREATED':
        result = await handleSubscriptionCreated(req.body);
        break;
        
      case 'SUBSCRIPTION_ACTIVATED':
        result = await handleSubscriptionActivated(req.body);
        break;
        
      case 'SUBSCRIPTION_RENEWED':
        result = await handleSubscriptionRenewed(req.body);
        break;
      
      case 'SUBSCRIPTION_CANCELLED':
      case 'SUBSCRIPTION_ENDED':
        result = await handleSubscriptionCancelled(req.body);
        break;
      
      default:
        console.log(`[AsaasWebhook ${requestId}] Evento não tratado: ${event}`);
        result = { processed: false, message: 'Evento não tratado' };
    }
    
    console.log(`[AsaasWebhook ${requestId}] Webhook processado com sucesso`);
    
    // Responder com sucesso
    return res.status(200).json({
      success: true,
      message: 'Webhook processado com sucesso',
      event,
      requestId,
      result
    });
    
  } catch (error) {
    console.error(`[AsaasWebhook ${requestId}] Erro ao processar webhook:`, error);
    
    // Responder com erro
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar webhook',
      event,
      requestId,
      error: error.message
    });
  }
});

/**
 * Atualiza ambas as coleções de assinatura
 */
async function updateSubscriptionCollections(data, status, details = {}) {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    
    // Extrair dados necessários
    const customerId = data.customer || data.payment?.customer || data.subscription?.customer;
    const subscriptionId = data.subscription || data.id;
    
    if (!customerId || !subscriptionId) {
      throw new Error('Dados de customerId ou subscriptionId ausentes');
    }
    
    // Atualizar coleção subscriptions
    const subscriptionUpdate = {
      $set: {
        status: status,
        original_asaas_status: data.status || status.toUpperCase(),
        updated_at: new Date()
      },
      $push: {
        status_history: {
          status: status,
          timestamp: new Date(),
          source: 'webhook',
          event: data.event,
          details: details
        }
      }
    };
    
    // Adicionar campos adicionais se presentes
    if (data.value) subscriptionUpdate.$set.value = data.value;
    if (data.billingType) subscriptionUpdate.$set.billing_type = data.billingType;
    if (data.nextDueDate) subscriptionUpdate.$set.next_due_date = new Date(data.nextDueDate);
    if (data.cycle) subscriptionUpdate.$set.cycle = data.cycle;
    
    // Atualizar coleção subscriptions
    const subscriptionResult = await db.collection('subscriptions').updateOne(
      { 
        $or: [
          { subscription_id: subscriptionId },
          { _id: ObjectId.isValid(subscriptionId) ? new ObjectId(subscriptionId) : null }
        ]
      },
      subscriptionUpdate,
      { upsert: false }
    );
    
    // Atualizar userSubscriptions
    const planType = await getPlanTypeFromSubscription(db, customerId);
    
    const userSubscriptionUpdate = {
      $set: {
        status: status,
        planType: planType || 'basic',
        updatedAt: new Date()
      }
    };
    
    if (data.nextDueDate) userSubscriptionUpdate.$set.nextDueDate = new Date(data.nextDueDate);
    
    // Atualizar coleção userSubscriptions
    const userSubscriptionResult = await db.collection('userSubscriptions').updateOne(
      { asaasCustomerId: customerId },
      userSubscriptionUpdate,
      { upsert: false }
    );
    
    // Se não tiver um registro em userSubscriptions, criar um
    if (userSubscriptionResult.matchedCount === 0) {
      // Buscar usuário pelo customerId
      const user = await db.collection('users').findOne({ customerId: customerId });
      
      if (user) {
        const newUserSubscription = {
          userId: user._id.toString(),
          asaasCustomerId: customerId,
          asaasSubscriptionId: subscriptionId,
          status: status,
          planType: planType || 'basic',
          nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await db.collection('userSubscriptions').insertOne(newUserSubscription);
      }
    }
    
    return {
      subscriptions: subscriptionResult,
      userSubscriptions: userSubscriptionResult
    };
    
  } finally {
    await client.close();
  }
}

/**
 * Obtém o tipo de plano a partir da assinatura
 */
async function getPlanTypeFromSubscription(db, customerId) {
  // Buscar na coleção subscriptions
  const subscription = await db.collection('subscriptions').findOne(
    { customer_id: customerId }
  );
  
  if (subscription && subscription.plan_id) {
    return subscription.plan_id;
  }
  
  // Se não encontrar, retornar o básico
  return 'basic';
}

/**
 * Processar evento de pagamento confirmado
 */
async function handlePaymentConfirmed(data) {
  return await updateSubscriptionCollections(data, 'active', {
    payment_id: data.id,
    value: data.value,
    payment_date: data.paymentDate
  });
}

/**
 * Processar evento de pagamento atrasado
 */
async function handlePaymentOverdue(data) {
  return await updateSubscriptionCollections(data, 'overdue', {
    payment_id: data.id,
    value: data.value,
    due_date: data.dueDate
  });
}

/**
 * Processar evento de pagamento cancelado
 */
async function handlePaymentCancelled(data) {
  return await updateSubscriptionCollections(data, 'inactive', {
    payment_id: data.id,
    value: data.value,
    reason: data.reason || 'payment_cancelled'
  });
}

/**
 * Processar evento de assinatura criada
 */
async function handleSubscriptionCreated(data) {
  return await updateSubscriptionCollections(data, 'pending', {
    subscription_id: data.id,
    value: data.value,
    cycle: data.cycle,
    next_due_date: data.nextDueDate
  });
}

/**
 * Processar evento de assinatura ativada
 */
async function handleSubscriptionActivated(data) {
  return await updateSubscriptionCollections(data, 'active', {
    subscription_id: data.id,
    value: data.value,
    cycle: data.cycle,
    next_due_date: data.nextDueDate
  });
}

/**
 * Processar evento de assinatura renovada
 */
async function handleSubscriptionRenewed(data) {
  return await updateSubscriptionCollections(data, 'active', {
    subscription_id: data.id,
    value: data.value,
    cycle: data.cycle,
    next_due_date: data.nextDueDate
  });
}

/**
 * Processar evento de assinatura cancelada
 */
async function handleSubscriptionCancelled(data) {
  return await updateSubscriptionCollections(data, 'inactive', {
    subscription_id: data.id,
    reason: data.reason || 'subscription_cancelled'
  });
}

module.exports = router; 