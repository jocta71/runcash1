/**
 * Rotas de webhook para receber e processar eventos Asaas
 * Responsável por manter o banco de dados sincronizado com os eventos da Asaas
 */

const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Chave secreta para verificação de assinatura do webhook (deve ser configurada no .env)
const WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET || '';

/**
 * Verifica a assinatura do webhook da Asaas
 * @param {Object} req - Request do Express
 * @returns {boolean} - Verdadeiro se a assinatura for válida
 */
function verifySignature(req) {
  // Se não houver chave secreta configurada, pule a verificação (não recomendado para produção)
  if (!WEBHOOK_SECRET) {
    console.warn('[Webhook] ⚠️ ASAAS_WEBHOOK_SECRET não configurada, pulando verificação de assinatura');
    return true;
  }
  
  const signature = req.headers['asaas-signature'] || '';
  const payload = JSON.stringify(req.body);
  
  // Calcular assinatura usando a chave secreta
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  // Comparar assinaturas
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
  
  if (!isValid) {
    console.error('[Webhook] ❌ Assinatura inválida para webhook Asaas');
  }
  
  return isValid;
}

/**
 * Atualiza a coleção 'subscriptions' com base no evento
 * @param {Object} db - Conexão com o banco MongoDB
 * @param {Object} event - Evento do webhook
 * @param {Object} user - Usuário associado ao evento
 * @returns {Promise<Object>} - Resultado da operação
 */
async function updateSubscriptionsCollection(db, event, user) {
  try {
    const subscriptionId = event.subscription?.id || event.payment?.subscription || null;
    
    if (!subscriptionId) {
      console.log('[Webhook] Evento sem ID de assinatura, ignorando atualização em subscriptions');
      return { success: false, reason: 'no_subscription_id' };
    }
    
    const customerId = event.customer?.id || null;
    
    if (!customerId) {
      console.log('[Webhook] Evento sem ID de cliente, ignorando atualização em subscriptions');
      return { success: false, reason: 'no_customer_id' };
    }
    
    // Determinar status com base no evento
    const status = getStatusFromEvent(event);
    
    // Verificar se já existe registro
    const existingSubscription = await db.collection('subscriptions').findOne({ 
      subscription_id: subscriptionId,
      customer_id: customerId
    });
    
    if (existingSubscription) {
      // Atualizar registro existente
      console.log(`[Webhook] Atualizando assinatura existente: ${subscriptionId}`);
      
      await db.collection('subscriptions').updateOne(
        { _id: existingSubscription._id },
        { 
          $set: { 
            status: status,
            original_asaas_status: event.status || event.payment?.status,
            updated_at: new Date()
          },
          $push: {
            status_history: {
              status: status,
              timestamp: new Date(),
              source: 'webhook',
              event_type: event.event,
              original_status: event.status || event.payment?.status
            }
          }
        }
      );
      
      return { 
        success: true, 
        operation: 'updated',
        subscriptionId
      };
    } else {
      // Criar novo registro
      console.log(`[Webhook] Criando nova entrada de assinatura: ${subscriptionId}`);
      
      // Dados essenciais
      const subscriptionData = {
        subscription_id: subscriptionId,
        customer_id: customerId,
        user_id: user?._id?.toString() || null,
        status: status,
        original_asaas_status: event.status || event.payment?.status,
        created_at: new Date(),
        updated_at: new Date(),
        status_history: [
          {
            status: status,
            timestamp: new Date(),
            source: 'webhook',
            event_type: event.event,
            original_status: event.status || event.payment?.status
          }
        ]
      };
      
      // Adicionar dados opcionais se disponíveis
      if (event.value) subscriptionData.value = event.value;
      if (event.billingType) subscriptionData.billing_type = event.billingType;
      if (event.billingType) subscriptionData.plan_id = event.billingType;
      
      await db.collection('subscriptions').insertOne(subscriptionData);
      
      return { 
        success: true, 
        operation: 'created',
        subscriptionId
      };
    }
  } catch (error) {
    console.error('[Webhook] Erro ao atualizar subscriptions:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Atualiza a coleção 'userSubscriptions' com base no evento
 * @param {Object} db - Conexão com o banco MongoDB
 * @param {Object} event - Evento do webhook
 * @param {Object} user - Usuário associado ao evento
 * @returns {Promise<Object>} - Resultado da operação
 */
async function updateUserSubscriptionsCollection(db, event, user) {
  try {
    const subscriptionId = event.subscription?.id || event.payment?.subscription || null;
    
    if (!subscriptionId) {
      console.log('[Webhook] Evento sem ID de assinatura, ignorando atualização em userSubscriptions');
      return { success: false, reason: 'no_subscription_id' };
    }
    
    const customerId = event.customer?.id || null;
    
    if (!customerId) {
      console.log('[Webhook] Evento sem ID de cliente, ignorando atualização em userSubscriptions');
      return { success: false, reason: 'no_customer_id' };
    }
    
    // Se não temos um usuário, não podemos atualizar userSubscriptions
    if (!user) {
      console.log('[Webhook] Usuário não encontrado para ID de cliente:', customerId);
      return { success: false, reason: 'no_user_found' };
    }
    
    // Determinar status com base no evento
    const status = getStatusFromEvent(event);
    
    // Calcular próxima data de vencimento
    let nextDueDate = null;
    
    if (event.nextDueDate) {
      nextDueDate = new Date(event.nextDueDate);
    } else if (event.payment && event.payment.dueDate) {
      // Adicionar 30 dias à data de vencimento para estimar o próximo vencimento
      nextDueDate = new Date(event.payment.dueDate);
      nextDueDate.setDate(nextDueDate.getDate() + 30);
    } else {
      // Se não houver data definida, estimar 30 dias a partir de hoje
      nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 30);
    }
    
    // Verificar se já existe registro
    const existingSubscription = await db.collection('userSubscriptions').findOne({ 
      asaasCustomerId: customerId
    });
    
    if (existingSubscription) {
      // Atualizar registro existente
      console.log(`[Webhook] Atualizando userSubscriptions para cliente: ${customerId}`);
      
      await db.collection('userSubscriptions').updateOne(
        { _id: existingSubscription._id },
        { 
          $set: { 
            status: status,
            asaasSubscriptionId: subscriptionId,
            nextDueDate: nextDueDate,
            updatedAt: new Date(),
            lastEvent: {
              type: event.event,
              timestamp: new Date(),
              status: event.status || event.payment?.status
            }
          }
        }
      );
      
      return { 
        success: true, 
        operation: 'updated',
        asaasCustomerId: customerId
      };
    } else {
      // Criar novo registro
      console.log(`[Webhook] Criando nova entrada em userSubscriptions para cliente: ${customerId}`);
      
      // Determinar tipo de plano
      const planType = event.billingType || 'basic';
      
      await db.collection('userSubscriptions').insertOne({
        userId: user._id.toString(),
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId,
        status: status,
        planType: planType,
        nextDueDate: nextDueDate,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastEvent: {
          type: event.event,
          timestamp: new Date(),
          status: event.status || event.payment?.status
        }
      });
      
      return { 
        success: true, 
        operation: 'created',
        asaasCustomerId: customerId
      };
    }
  } catch (error) {
    console.error('[Webhook] Erro ao atualizar userSubscriptions:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Determina o status local com base no evento do Asaas
 * @param {Object} event - Evento do webhook
 * @returns {string} - Status local
 */
function getStatusFromEvent(event) {
  // Eventos de pagamento
  if (event.event && event.event.startsWith('PAYMENT_')) {
    switch (event.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_APPROVED_BY_ANTICIPATION':
      case 'PAYMENT_UPDATED':
        return 'active';
      case 'PAYMENT_OVERDUE':
        return 'overdue';
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
      case 'PAYMENT_CHARGEBACK_DISPUTE':
        return 'inactive';
      default:
        // Para outros tipos de eventos de pagamento, verificar o status do pagamento
        if (event.payment && event.payment.status) {
          return mapAsaasStatusToLocal(event.payment.status);
        }
    }
  }
  
  // Eventos de assinatura
  if (event.event && event.event.startsWith('SUBSCRIPTION_')) {
    switch (event.event) {
      case 'SUBSCRIPTION_CREATED':
        return 'pending';
      case 'SUBSCRIPTION_PAYMENT_CREATED':
      case 'SUBSCRIPTION_PAYMENT_CONFIRMED':
      case 'SUBSCRIPTION_PAYMENT_RECEIVED':
      case 'SUBSCRIPTION_RENEWED':
        return 'active';
      case 'SUBSCRIPTION_PAYMENT_OVERDUE':
        return 'overdue';
      case 'SUBSCRIPTION_CANCELLED':
        return 'canceled';
      case 'SUBSCRIPTION_EXPIRED':
        return 'expired';
      default:
        // Para outros tipos de eventos de assinatura, verificar o status da assinatura
        if (event.status) {
          return mapAsaasStatusToLocal(event.status);
        }
    }
  }
  
  // Status direto do evento
  if (event.status) {
    return mapAsaasStatusToLocal(event.status);
  }
  
  // Status do pagamento no evento
  if (event.payment && event.payment.status) {
    return mapAsaasStatusToLocal(event.payment.status);
  }
  
  // Default - indefinido
  return 'pending';
}

/**
 * Mapeia status do Asaas para formato local
 * @param {string} asaasStatus - Status do Asaas
 * @returns {string} - Status local
 */
function mapAsaasStatusToLocal(asaasStatus) {
  switch (asaasStatus) {
    case 'ACTIVE':
      return 'active';
    case 'INACTIVE':
      return 'inactive';
    case 'EXPIRED':
      return 'expired';
    case 'OVERDUE':
      return 'overdue';
    case 'CANCELED':
      return 'canceled';
    case 'CONFIRMED':
    case 'RECEIVED':
      return 'active';
    case 'PENDING':
      return 'pending';
    case 'REFUNDED':
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
      return 'inactive';
    default:
      return asaasStatus.toLowerCase();
  }
}

/**
 * Rota de webhook para eventos do Asaas
 * Esta rota recebe notificações sobre mudanças de status nas assinaturas
 * e atualiza o banco de dados local
 */
router.post('/asaas', async (req, res) => {
  // ID da request para rastreamento
  const requestId = uuidv4();
  console.log(`[Webhook] Recebendo webhook Asaas - ID: ${requestId}`);
  
  let client;
  
  try {
    // Verificar signature do webhook, se falhar retorna 403
    if (!verifySignature(req)) {
      console.error(`[Webhook] ${requestId} - Assinatura inválida`);
      return res.status(403).json({ 
        success: false, 
        message: 'Assinatura inválida',
        requestId
      });
    }
    
    // Log do evento recebido
    console.log(`[Webhook] ${requestId} - Evento: ${req.body.event || 'Desconhecido'}`);
    console.log(`[Webhook] ${requestId} - Payload:`, JSON.stringify(req.body).slice(0, 300) + '...');
    
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    
    // Buscar usuário pelo customerId
    const customerId = req.body.customer?.id || req.body.payment?.customer || null;
    let user = null;
    
    if (customerId) {
      user = await db.collection('users').findOne({ 
        $or: [
          { customerId: customerId },
          { customer_id: customerId }
        ]
      });
      
      if (user) {
        console.log(`[Webhook] ${requestId} - Usuário encontrado: ${user.email || user._id}`);
      } else {
        console.log(`[Webhook] ${requestId} - Usuário não encontrado para customer_id: ${customerId}`);
      }
    }
    
    // Processar o evento somente para eventos relacionados a assinaturas ou pagamentos
    if (req.body.event && (req.body.event.startsWith('SUBSCRIPTION_') || req.body.event.startsWith('PAYMENT_'))) {
      // Atualizar collections no banco de dados
      const updateResults = await Promise.all([
        updateSubscriptionsCollection(db, req.body, user),
        updateUserSubscriptionsCollection(db, req.body, user)
      ]);
      
      console.log(`[Webhook] ${requestId} - Resultados da atualização:`, updateResults);
      
      // Adicionar log do webhook completo
      await db.collection('webhookLogs').insertOne({
        requestId,
        event: req.body.event,
        payload: req.body,
        timestamp: new Date(),
        processed: true,
        updateResults
      });
    } else {
      // Registrar webhook recebido, mas não processado por não ser relevante
      await db.collection('webhookLogs').insertOne({
        requestId,
        event: req.body.event || 'unknown',
        payload: req.body,
        timestamp: new Date(),
        processed: false,
        reason: 'not_subscription_related'
      });
      
      console.log(`[Webhook] ${requestId} - Evento ignorado: não está relacionado a assinaturas`);
    }
    
    // Responder com sucesso
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processado com sucesso',
      requestId
    });
    
  } catch (error) {
    console.error(`[Webhook] ${requestId} - Erro ao processar webhook:`, error);
    
    // Em caso de erro, registrar no log
    try {
      if (client && client.topology.isConnected()) {
        const db = client.db(MONGODB_DB_NAME);
        await db.collection('webhookLogs').insertOne({
          requestId,
          event: req.body.event || 'unknown',
          payload: req.body,
          timestamp: new Date(),
          processed: false,
          error: error.message,
          stack: error.stack
        });
      }
    } catch (logError) {
      console.error(`[Webhook] ${requestId} - Erro ao registrar erro:`, logError);
    }
    
    // Mesmo em caso de erro interno, responder com 200 para o Asaas não retentar
    // Isso evita múltiplas tentativas que podem causar mais erros
    // Os erros ficarão registrados no log para análise posterior
    res.status(200).json({ 
      success: false, 
      message: 'Erro ao processar webhook, mas foi registrado para análise',
      requestId
    });
  } finally {
    // Garantir que a conexão seja fechada
    if (client) {
      await client.close();
    }
  }
});

module.exports = router; 