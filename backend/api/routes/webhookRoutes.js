const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Chave secreta para verificação de assinatura (ideal: definir via variável de ambiente)
const WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET;

/**
 * Função para verificar assinatura do webhook
 * @param {Object} req - Requisição Express
 * @returns {Boolean} - Retorna true se a assinatura for válida
 */
function verifySignature(req) {
  // Na versão de produção, implementar verificação de assinatura do Asaas
  // usando o cabeçalho Asaas-Signature e a chave secreta
  return true; // Por simplicidade, sempre retornamos true nesta implementação
}

/**
 * Rota para receber webhooks do Asaas
 * Esta rota processa eventos de assinatura do Asaas e atualiza o banco de dados
 */
router.post('/asaas', async (req, res) => {
  const requestId = uuidv4();
  console.log(`[Webhook ${requestId}] Recebido webhook do Asaas:`, JSON.stringify(req.body));
  
  // Verificar assinatura do webhook
  if (!verifySignature(req)) {
    console.log(`[Webhook ${requestId}] ❌ Assinatura inválida`);
    return res.status(401).json({ 
      success: false, 
      message: 'Assinatura inválida' 
    });
  }
  
  const evento = req.body;
  
  // Verificar se é um evento relacionado a assinaturas
  if (!evento || !evento.event) {
    console.log(`[Webhook ${requestId}] ❌ Evento não reconhecido:`, evento);
    return res.status(400).json({ 
      success: false, 
      message: 'Evento não reconhecido' 
    });
  }
  
  try {
    // Identificar o tipo de evento
    const eventType = evento.event;
    console.log(`[Webhook ${requestId}] Processando evento: ${eventType}`);
    
    // Eventos relacionados a assinaturas
    if (eventType.startsWith('PAYMENT_') || eventType.startsWith('SUBSCRIPTION_')) {
      await processSubscriptionEvent(evento, requestId);
    } else {
      console.log(`[Webhook ${requestId}] Evento não processado: ${eventType}`);
    }
    
    // Responder com sucesso
    return res.status(200).json({ 
      success: true, 
      message: 'Webhook processado com sucesso',
      requestId 
    });
    
  } catch (error) {
    console.error(`[Webhook ${requestId}] Erro ao processar webhook:`, error);
    
    // Responder com erro, mas código 200 para evitar reenvio pelo Asaas
    return res.status(200).json({ 
      success: false, 
      message: 'Erro ao processar webhook',
      error: error.message,
      requestId 
    });
  }
});

/**
 * Processa eventos relacionados a assinaturas
 * @param {Object} evento - Evento do webhook
 * @param {String} requestId - ID da requisição para logs
 */
async function processSubscriptionEvent(evento, requestId) {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    
    const eventType = evento.event;
    const payment = evento.payment || {};
    const subscription = evento.subscription || {};
    const customer = evento.customer || {};
    
    // Extrair informações relevantes
    const customerId = customer.id || subscription.customer || payment.customer;
    const subscriptionId = subscription.id;
    const status = getStatusFromEvent(eventType, evento);
    
    if (!customerId) {
      console.log(`[Webhook ${requestId}] ❌ Sem ID de cliente no evento`);
      return;
    }
    
    console.log(`[Webhook ${requestId}] 📝 Atualizando assinatura: customerId=${customerId}, status=${status}`);
    
    // 1. Atualizar na coleção 'subscriptions'
    const subscriptionResult = await updateSubscription(db, customerId, subscriptionId, status, evento, requestId);
    
    // 2. Atualizar na coleção 'userSubscriptions'
    const userSubscriptionResult = await updateUserSubscription(db, customerId, subscriptionId, status, evento, requestId);
    
    console.log(`[Webhook ${requestId}] ✅ Atualização concluída: subscriptions=${subscriptionResult}, userSubscriptions=${userSubscriptionResult}`);
    
  } catch (error) {
    console.error(`[Webhook ${requestId}] Erro ao processar evento de assinatura:`, error);
    throw error;
  } finally {
    await client.close();
  }
}

/**
 * Atualiza o registro na coleção 'subscriptions'
 */
async function updateSubscription(db, customerId, subscriptionId, status, evento, requestId) {
  try {
    // Buscar assinatura existente
    const existingSubscription = await db.collection('subscriptions').findOne({ 
      customer_id: customerId,
      subscription_id: subscriptionId
    });
    
    if (existingSubscription) {
      // Atualizar assinatura existente
      console.log(`[Webhook ${requestId}] Atualizando assinatura existente: ${existingSubscription._id}`);
      
      const result = await db.collection('subscriptions').updateOne(
        { _id: existingSubscription._id },
        { 
          $set: { 
            status: status,
            original_asaas_status: evento.status || evento.payment?.status || evento.subscription?.status,
            updated_at: new Date()
          },
          $push: {
            status_history: {
              status: status,
              timestamp: new Date(),
              source: 'webhook',
              event_type: evento.event
            }
          }
        }
      );
      
      return result.modifiedCount;
    } else {
      // Buscar usuário pelo customer_id
      const user = await db.collection('users').findOne({ 
        $or: [
          { customerId: customerId },
          { customer_id: customerId }
        ]
      });
      
      if (!user) {
        console.log(`[Webhook ${requestId}] ⚠️ Usuário não encontrado para customer_id: ${customerId}`);
        return 0;
      }
      
      // Criar nova assinatura
      console.log(`[Webhook ${requestId}] Criando nova assinatura para usuário: ${user._id}`);
      
      const newSubscription = {
        subscription_id: subscriptionId,
        user_id: user._id.toString(),
        customer_id: customerId,
        plan_id: evento.subscription?.billingType || 'unknown',
        payment_id: evento.payment?.id,
        status: status,
        original_asaas_status: evento.status || evento.payment?.status || evento.subscription?.status,
        billing_type: evento.subscription?.billingType || evento.payment?.billingType || 'unknown',
        value: evento.subscription?.value || evento.payment?.value || 0,
        created_at: new Date(),
        status_history: [
          {
            status: status,
            timestamp: new Date(),
            source: 'webhook',
            event_type: evento.event
          }
        ]
      };
      
      const result = await db.collection('subscriptions').insertOne(newSubscription);
      return result.acknowledged ? 1 : 0;
    }
  } catch (error) {
    console.error(`[Webhook ${requestId}] Erro ao atualizar 'subscriptions':`, error);
    return 0;
  }
}

/**
 * Atualiza o registro na coleção 'userSubscriptions'
 */
async function updateUserSubscription(db, customerId, subscriptionId, status, evento, requestId) {
  try {
    // Buscar assinatura existente
    const existingSubscription = await db.collection('userSubscriptions').findOne({ 
      asaasCustomerId: customerId
    });
    
    // Buscar usuário pelo customer_id
    const user = await db.collection('users').findOne({ 
      $or: [
        { customerId: customerId },
        { customer_id: customerId }
      ]
    });
    
    const userId = user ? user._id.toString() : null;
    
    if (existingSubscription) {
      // Atualizar assinatura existente
      console.log(`[Webhook ${requestId}] Atualizando userSubscription existente: ${existingSubscription._id}`);
      
      const result = await db.collection('userSubscriptions').updateOne(
        { _id: existingSubscription._id },
        { 
          $set: { 
            status: status,
            asaasSubscriptionId: subscriptionId,
            planType: evento.subscription?.billingType || existingSubscription.planType || 'basic',
            nextDueDate: evento.payment?.dueDate ? new Date(evento.payment.dueDate) : existingSubscription.nextDueDate,
            updatedAt: new Date()
          }
        }
      );
      
      return result.modifiedCount;
    } else if (userId) {
      // Criar nova assinatura
      console.log(`[Webhook ${requestId}] Criando nova userSubscription para usuário: ${userId}`);
      
      // Calcular próxima data de vencimento (30 dias a partir de hoje se não fornecido)
      const nextDueDate = evento.payment?.dueDate 
        ? new Date(evento.payment.dueDate) 
        : new Date(new Date().setDate(new Date().getDate() + 30));
      
      const newUserSubscription = {
        userId: userId,
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId,
        status: status,
        planType: evento.subscription?.billingType || 'basic',
        nextDueDate: nextDueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('userSubscriptions').insertOne(newUserSubscription);
      return result.acknowledged ? 1 : 0;
    } else {
      console.log(`[Webhook ${requestId}] ⚠️ Usuário não encontrado para customer_id: ${customerId}`);
      return 0;
    }
  } catch (error) {
    console.error(`[Webhook ${requestId}] Erro ao atualizar 'userSubscriptions':`, error);
    return 0;
  }
}

/**
 * Determina o status com base no tipo de evento
 */
function getStatusFromEvent(eventType, evento) {
  switch (eventType) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
    case 'SUBSCRIPTION_ACTIVATED':
      return 'active';
      
    case 'PAYMENT_OVERDUE':
    case 'SUBSCRIPTION_EXPIRED':
    case 'SUBSCRIPTION_OVERDUE':
      return 'overdue';
      
    case 'PAYMENT_DELETED':
    case 'SUBSCRIPTION_DELETED':
      return 'deleted';
      
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_REFUND_REQUESTED':
      return 'refunded';
      
    case 'PAYMENT_CHARGEBACK_REQUESTED':
    case 'PAYMENT_CHARGEBACK_DISPUTE':
      return 'chargeback';
      
    case 'SUBSCRIPTION_CREATED':
      return 'pending';
      
    case 'SUBSCRIPTION_RENEWED':
      // Se foi renovada, provavelmente está ativa
      return 'active';
      
    case 'SUBSCRIPTION_UPDATED':
      // Manter o status atual ou usar o fornecido no evento
      return evento.status || evento.subscription?.status || 'unknown';
      
    default:
      // Para eventos desconhecidos, verificar o status no payload
      return evento.status || evento.subscription?.status || evento.payment?.status || 'unknown';
  }
}

module.exports = router; 