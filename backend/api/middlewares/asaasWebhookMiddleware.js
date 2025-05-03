/**
 * Middleware para processar webhooks do Asaas
 * Responsável por manter as coleções 'subscriptions' e 'userSubscriptions' consistentes
 */

const { MongoClient, ObjectId } = require('mongodb');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

/**
 * Processa webhook recebido do Asaas
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
async function processAsaasWebhook(req, res, next) {
  const webhookData = req.body;
  const eventType = webhookData?.event;
  
  // Log completo para debug
  console.log(`[Webhook] Recebido evento: ${eventType}`);
  if (process.env.NODE_ENV === 'development') {
    console.log('[Webhook] Dados completos:', JSON.stringify(webhookData, null, 2));
  }
  
  // Se não for um evento válido, apenas finaliza o processamento
  if (!eventType) {
    console.log('[Webhook] Evento sem tipo definido, ignorando');
    return res.status(200).json({ message: 'Webhook recebido mas sem tipo de evento reconhecido' });
  }
  
  try {
    // Processar o webhook de acordo com o tipo de evento
    if (eventType.startsWith('PAYMENT_')) {
      await processPaymentEvent(webhookData);
    } else if (eventType.startsWith('SUBSCRIPTION_')) {
      await processSubscriptionEvent(webhookData);
    } else if (eventType.startsWith('CUSTOMER_')) {
      await processCustomerEvent(webhookData);
    } else {
      console.log(`[Webhook] Tipo de evento não processado: ${eventType}`);
    }
    
    // Sempre retorna sucesso para o Asaas, mesmo em caso de erro interno
    // Isso evita que o Asaas tente reenviar o webhook em caso de falha no processamento
    return res.status(200).json({ message: 'Webhook processado com sucesso' });
  } catch (error) {
    console.error('[Webhook] Erro ao processar webhook:', error);
    // Ainda retornamos 200 para o Asaas, mas logamos o erro
    return res.status(200).json({ 
      message: 'Webhook recebido, mas ocorreu um erro durante o processamento',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
    });
  }
}

/**
 * Processa eventos relacionados a pagamentos
 * @param {Object} webhookData - Dados do webhook
 */
async function processPaymentEvent(webhookData) {
  const eventType = webhookData.event;
  const payment = webhookData.payment;
  
  if (!payment) {
    console.log('[Webhook] Evento de pagamento sem dados do pagamento');
    return;
  }
  
  // Extrair informações do pagamento
  const subscriptionId = payment.subscription;
  
  // Se não tiver ID da assinatura, não é um pagamento de assinatura
  if (!subscriptionId) {
    console.log('[Webhook] Pagamento não relacionado a uma assinatura, ignorando');
    return;
  }
  
  let status;
  switch (eventType) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_APPROVED':
      status = 'active';
      break;
    case 'PAYMENT_OVERDUE':
    case 'PAYMENT_REJECTED':
    case 'PAYMENT_DENIED':
    case 'PAYMENT_CHARGEBACK':
      status = 'inactive';
      break;
    case 'PAYMENT_DELETED':
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_CANCELLED':
      status = 'cancelled';
      break;
    default:
      console.log(`[Webhook] Evento de pagamento não tratado: ${eventType}`);
      return;
  }
  
  // Conectar ao MongoDB e atualizar
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    
    // 1. Atualizar a coleção 'subscriptions'
    const subscriptionData = await db.collection('subscriptions').findOne({
      subscription_id: subscriptionId
    });
    
    if (subscriptionData) {
      // Atualizar o status
      await db.collection('subscriptions').updateOne(
        { subscription_id: subscriptionId },
        {
          $set: {
            status: status,
            lastPaymentStatus: eventType,
            updatedAt: new Date()
          }
        }
      );
      
      // 2. Atualizar a coleção 'userSubscriptions'
      await updateUserSubscription(db, subscriptionData, status);
      
      console.log(`[Webhook] Atualizado status da assinatura ${subscriptionId} para ${status}`);
    } else {
      console.log(`[Webhook] Assinatura não encontrada: ${subscriptionId}`);
    }
  } finally {
    await client.close();
  }
}

/**
 * Processa eventos relacionados a assinaturas
 * @param {Object} webhookData - Dados do webhook
 */
async function processSubscriptionEvent(webhookData) {
  const eventType = webhookData.event;
  const subscription = webhookData.subscription;
  
  if (!subscription) {
    console.log('[Webhook] Evento de assinatura sem dados da assinatura');
    return;
  }
  
  const subscriptionId = subscription.id;
  const customerId = subscription.customer;
  
  if (!subscriptionId || !customerId) {
    console.log('[Webhook] Dados de assinatura incompletos');
    return;
  }
  
  let status;
  switch (eventType) {
    case 'SUBSCRIPTION_CREATED':
      status = 'pending'; // Aguardando primeiro pagamento
      break;
    case 'SUBSCRIPTION_RENEWED':
    case 'SUBSCRIPTION_UPDATED':
      status = 'active';
      break;
    case 'SUBSCRIPTION_CANCELLED':
    case 'SUBSCRIPTION_DELETED':
      status = 'cancelled';
      break;
    case 'SUBSCRIPTION_EXPIRED':
      status = 'inactive';
      break;
    default:
      console.log(`[Webhook] Evento de assinatura não tratado: ${eventType}`);
      return;
  }
  
  // Conectar ao MongoDB e atualizar
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    
    // 1. Verificar se a assinatura já existe
    const existingSubscription = await db.collection('subscriptions').findOne({
      subscription_id: subscriptionId
    });
    
    if (existingSubscription) {
      // Atualizar assinatura existente
      await db.collection('subscriptions').updateOne(
        { subscription_id: subscriptionId },
        {
          $set: {
            status: status,
            lastEvent: eventType,
            updatedAt: new Date()
          }
        }
      );
      
      // 2. Atualizar a coleção 'userSubscriptions'
      await updateUserSubscription(db, existingSubscription, status);
      
      console.log(`[Webhook] Atualizada assinatura existente ${subscriptionId} para ${status}`);
    } else {
      // Criar novo registro de assinatura
      console.log(`[Webhook] Assinatura ${subscriptionId} não encontrada na base de dados, buscando usuário relacionado`);
      
      // Procurar usuário pelo customerId
      const user = await db.collection('users').findOne({
        customerId: customerId
      });
      
      if (!user) {
        console.log(`[Webhook] Nenhum usuário encontrado com customerId ${customerId}`);
        return;
      }
      
      // Criar novo registro na coleção 'subscriptions'
      const newSubscription = {
        subscription_id: subscriptionId,
        customer_id: customerId,
        user_id: user._id.toString(),
        status: status,
        plan_id: subscription.billingType || 'basic',
        lastEvent: eventType,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('subscriptions').insertOne(newSubscription);
      
      // Criar registro correspondente em 'userSubscriptions'
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 30);
      
      const newUserSubscription = {
        userId: user._id.toString(),
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId,
        status: status,
        planType: subscription.billingType || 'basic',
        nextDueDate: nextDueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.collection('userSubscriptions').insertOne(newUserSubscription);
      
      console.log(`[Webhook] Criada nova assinatura ${subscriptionId} com status ${status}`);
    }
  } finally {
    await client.close();
  }
}

/**
 * Processa eventos relacionados a clientes
 * @param {Object} webhookData - Dados do webhook
 */
async function processCustomerEvent(webhookData) {
  const eventType = webhookData.event;
  const customer = webhookData.customer;
  
  if (!customer) {
    console.log('[Webhook] Evento de cliente sem dados do cliente');
    return;
  }
  
  const customerId = customer.id;
  
  if (!customerId) {
    console.log('[Webhook] Dados de cliente incompletos');
    return;
  }
  
  // Processamento específico para eventos de cliente
  if (eventType === 'CUSTOMER_DELETED') {
    // Conectar ao MongoDB e marcar assinaturas como canceladas
    const client = new MongoClient(MONGODB_URI);
    try {
      await client.connect();
      const db = client.db(MONGODB_DB_NAME);
      
      // Atualizar todas as assinaturas do cliente
      await db.collection('subscriptions').updateMany(
        { customer_id: customerId },
        {
          $set: {
            status: 'cancelled',
            lastEvent: eventType,
            updatedAt: new Date()
          }
        }
      );
      
      // Atualizar todos os registros em userSubscriptions
      await db.collection('userSubscriptions').updateMany(
        { asaasCustomerId: customerId },
        {
          $set: {
            status: 'inactive',
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`[Webhook] Cliente ${customerId} removido, assinaturas marcadas como canceladas`);
    } finally {
      await client.close();
    }
  } else {
    console.log(`[Webhook] Evento de cliente não tratado: ${eventType}`);
  }
}

/**
 * Atualiza ou cria um registro na coleção 'userSubscriptions'
 * @param {Object} db - Instância do banco de dados MongoDB
 * @param {Object} subscriptionData - Dados da assinatura
 * @param {string} status - Novo status
 */
async function updateUserSubscription(db, subscriptionData, status) {
  const customerId = subscriptionData.customer_id;
  const subscriptionId = subscriptionData.subscription_id;
  const userId = subscriptionData.user_id;
  
  if (!customerId || !subscriptionId || !userId) {
    console.log('[Webhook] Dados incompletos para atualizar userSubscription');
    return;
  }
  
  // Verificar se existe registro em 'userSubscriptions'
  const existingUserSubscription = await db.collection('userSubscriptions').findOne({
    asaasCustomerId: customerId,
    asaasSubscriptionId: subscriptionId
  });
  
  if (existingUserSubscription) {
    // Atualizar registro existente
    await db.collection('userSubscriptions').updateOne(
      { 
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId
      },
      {
        $set: {
          status: status,
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`[Webhook] Atualizado registro existente em userSubscriptions: ${existingUserSubscription._id}`);
  } else {
    // Criar novo registro
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 30);
    
    const newUserSubscription = {
      userId: userId,
      asaasCustomerId: customerId,
      asaasSubscriptionId: subscriptionId,
      status: status,
      planType: subscriptionData.plan_id || 'basic',
      nextDueDate: nextDueDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('userSubscriptions').insertOne(newUserSubscription);
    
    console.log(`[Webhook] Criado novo registro em userSubscriptions para assinatura ${subscriptionId}`);
  }
}

module.exports = { processAsaasWebhook }; 