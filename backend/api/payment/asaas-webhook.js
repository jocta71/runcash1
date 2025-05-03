const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configurações da API Asaas
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

console.log(`[WEBHOOK] Usando Asaas em ambiente: ${ASAAS_ENVIRONMENT}`);
console.log(`[WEBHOOK] API URL: ${API_BASE_URL}`);

/**
 * Busca detalhes completos de uma assinatura
 * @param {string} subscriptionId - ID da assinatura no Asaas
 * @returns {Promise<Object>} Detalhes da assinatura
 */
async function getSubscriptionDetails(subscriptionId) {
  try {
    console.log(`[WEBHOOK] Buscando detalhes da assinatura ${subscriptionId}`);
    const response = await axios.get(
      `${API_BASE_URL}/subscriptions/${subscriptionId}`,
      { headers: { 'access_token': ASAAS_API_KEY } }
    );
    console.log(`[WEBHOOK] Detalhes da assinatura ${subscriptionId} obtidos com sucesso`);
    return response.data;
  } catch (error) {
    console.error(`[WEBHOOK] Erro ao buscar detalhes da assinatura ${subscriptionId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca detalhes de um pagamento
 * @param {string} paymentId - ID do pagamento no Asaas
 * @returns {Promise<Object>} Detalhes do pagamento
 */
async function getPaymentDetails(paymentId) {
  try {
    console.log(`[WEBHOOK] Buscando detalhes do pagamento ${paymentId}`);
    const response = await axios.get(
      `${API_BASE_URL}/payments/${paymentId}`,
      { headers: { 'access_token': ASAAS_API_KEY } }
    );
    console.log(`[WEBHOOK] Detalhes do pagamento ${paymentId} obtidos com sucesso`);
    return response.data;
  } catch (error) {
    console.error(`[WEBHOOK] Erro ao buscar detalhes do pagamento ${paymentId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Handler principal do webhook
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 */
module.exports = async (req, res) => {
  // Configurar CORS para aceitar qualquer origem
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Responder a requisições preflight OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Para requisições GET (verificação do webhook)
  if (req.method === 'GET') {
    console.log('[WEBHOOK] Requisição GET recebida para verificação do webhook');
    return res.status(200).json({ 
      status: 'Webhook endpoint ativo. Use POST para eventos do Asaas.',
      timestamp: new Date().toISOString(),
      url: req.url,
      headers: req.headers
    });
  }

  if (req.method !== 'POST') {
    console.log(`[WEBHOOK] Método não permitido: ${req.method}`);
    return res.status(405).json({ error: 'Method Not Allowed', method: req.method });
  }

  let client;
  let webhookEventId = `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    // Extrair dados do webhook
    const webhookData = req.body;
    
    // Log completo para debugging
    console.log(`[WEBHOOK] ${webhookEventId} - Evento recebido do Asaas - HEADERS:`, JSON.stringify(req.headers, null, 2));
    console.log(`[WEBHOOK] ${webhookEventId} - Evento recebido do Asaas - BODY:`, JSON.stringify(webhookData, null, 2));
    
    // Conectar ao MongoDB
    const connectionString = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
    console.log(`[WEBHOOK] ${webhookEventId} - Conectando ao MongoDB...`);
    client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    console.log(`[WEBHOOK] ${webhookEventId} - Conectado ao MongoDB`);
    
    // Verificar se este evento já foi processado
    const existingEvent = await db.collection('processedWebhooks').findOne({
      'event.id': webhookData.id,
      'event.event': webhookData.event
    });
    
    if (existingEvent) {
      console.log(`[WEBHOOK] ${webhookEventId} - Evento já processado anteriormente: ${webhookData.event}, ID: ${webhookData.id}`);
      return res.status(200).json({ 
        success: true, 
        message: 'Evento já processado anteriormente'
      });
    }
    
    // Registrar o log do webhook
    await db.collection('webhook_logs').insertOne({
      webhook_id: webhookEventId,
      provider: 'asaas',
      event_type: webhookData.event,
      headers: req.headers,
      payload: webhookData,
      created_at: new Date()
    });
    
    console.log(`[WEBHOOK] ${webhookEventId} - Log registrado com sucesso`);
    
    // Processar diferentes tipos de eventos
    const eventType = webhookData.event;
    console.log(`[WEBHOOK] ${webhookEventId} - Processando evento ${eventType}`);
    
    // Extrair dados de pagamento ou assinatura dependendo do tipo de evento
    let payment = webhookData.payment;
    let subscription = webhookData.subscription;
    let subscriptionId = null;
    let paymentId = null;
    
    // Se for evento direto de assinatura
    if (eventType === 'SUBSCRIPTION_CREATED' || eventType === 'SUBSCRIPTION_UPDATED' || 
        eventType === 'SUBSCRIPTION_CANCELLED' || eventType === 'SUBSCRIPTION_RENEWED') {
      
      if (subscription) {
        subscriptionId = subscription.id;
        console.log(`[WEBHOOK] ${webhookEventId} - Evento direto de assinatura: ${eventType}, ID: ${subscriptionId}`);
      } else {
        console.log(`[WEBHOOK] ${webhookEventId} - Evento de assinatura sem dados da assinatura:`, webhookData);
        
        // Registrar o erro e continuar processando
        await db.collection('asaas_events').insertOne({
          webhook_id: webhookEventId,
          event_type: eventType,
          event_data: webhookData,
          error: 'Dados da assinatura não fornecidos',
          status: 'error',
          created_at: new Date()
        });
        
        return res.status(400).json({ error: 'Dados da assinatura não fornecidos' });
      }
    } 
    // Verificar eventos de pagamento relacionados a assinaturas
    else if (payment) {
      paymentId = payment.id;
      subscriptionId = payment.subscription;
      console.log(`[WEBHOOK] ${webhookEventId} - Evento de pagamento: ${eventType}, ID pagamento: ${paymentId}, ID assinatura: ${subscriptionId}`);
    } else {
      console.log(`[WEBHOOK] ${webhookEventId} - Evento sem dados de pagamento ou assinatura:`, webhookData);
      
      // Registrar o erro e continuar processando
      await db.collection('asaas_events').insertOne({
        webhook_id: webhookEventId,
        event_type: eventType,
        event_data: webhookData,
        error: 'Dados de pagamento ou assinatura não fornecidos',
        status: 'error',
        created_at: new Date()
      });
      
      return res.status(400).json({ error: 'Dados de pagamento ou assinatura não fornecidos' });
    }
    
    // Se não houver ID de assinatura, tentar obter a partir do pagamento
    if (!subscriptionId && paymentId) {
      try {
        console.log(`[WEBHOOK] ${webhookEventId} - Buscando detalhes do pagamento para encontrar a assinatura relacionada`);
        const paymentDetails = await getPaymentDetails(paymentId);
        subscriptionId = paymentDetails.subscription;
        
        console.log(`[WEBHOOK] ${webhookEventId} - Assinatura encontrada através do pagamento: ${subscriptionId}`);
      } catch (error) {
        console.error(`[WEBHOOK] ${webhookEventId} - Erro ao buscar detalhes do pagamento:`, error);
      }
    }
    
    // Se ainda não houver ID de assinatura, responder com erro
    if (!subscriptionId) {
      console.log(`[WEBHOOK] ${webhookEventId} - Evento não relacionado a uma assinatura`, payment);
      
      // Registrar o evento mesmo assim
      await db.collection('asaas_events').insertOne({
        webhook_id: webhookEventId,
        event_type: eventType,
        event_data: webhookData,
        status: 'ignored',
        reason: 'Não relacionado a uma assinatura',
        created_at: new Date()
      });
      
      return res.status(200).json({ message: 'Evento ignorado - não é uma assinatura' });
    }
    
    // Buscar detalhes da assinatura no Asaas
    let subscriptionDetails;
    try {
      subscriptionDetails = await getSubscriptionDetails(subscriptionId);
      console.log(`[WEBHOOK] ${webhookEventId} - Detalhes da assinatura:`, JSON.stringify(subscriptionDetails, null, 2));
    } catch (error) {
      console.error(`[WEBHOOK] ${webhookEventId} - Erro ao buscar detalhes da assinatura:`, error.message);
      
      // Registrar o erro mas continuar o processamento
      await db.collection('asaas_events').insertOne({
        webhook_id: webhookEventId,
        event_type: eventType,
        subscription_id: subscriptionId,
        payment_id: paymentId,
        event_data: webhookData,
        error: `Erro ao buscar detalhes da assinatura: ${error.message}`,
        status: 'warning',
        created_at: new Date()
      });
    }
    
    // Buscar assinatura no MongoDB pelo subscription_id ou payment_id
    const query = { $or: [
      { subscription_id: subscriptionId },
      { payment_id: paymentId || subscriptionId }
    ]};
    
    console.log(`[WEBHOOK] ${webhookEventId} - Buscando assinatura no MongoDB com query:`, JSON.stringify(query));
    
    const subscriptionData = await db.collection('subscriptions').findOne(query);
    console.log(`[WEBHOOK] ${webhookEventId} - Resultado da busca por assinatura:`, subscriptionData ? 'Encontrada' : 'Não encontrada');
    
    // Se a assinatura não existir no banco, mas existir no Asaas, criar novo registro
    if (!subscriptionData && subscriptionDetails) {
      // Buscar usuário pelo customer ID no Asaas
      const userId = await getUserIdFromAsaasCustomer(db, subscriptionDetails.customer);
      
      if (userId) {
        // Criar nova assinatura no banco
        const newSubscription = {
          subscription_id: subscriptionId,
          user_id: userId,
          payment_id: paymentId || subscriptionId,
          customer_id: subscriptionDetails.customer,
          plan_id: mapPlanType(subscriptionDetails.value, subscriptionDetails.cycle),
          status: subscriptionDetails.status.toLowerCase(),
          original_asaas_status: subscriptionDetails.status,
          billing_type: subscriptionDetails.billingType,
          value: subscriptionDetails.value,
          created_at: new Date(),
          updated_at: new Date(),
          status_history: [
            {
              status: subscriptionDetails.status.toLowerCase(),
              timestamp: new Date(),
              source: `webhook_${eventType}`
            }
          ]
        };
        
        await db.collection('subscriptions').insertOne(newSubscription);
        
        console.log(`[WEBHOOK] ${webhookEventId} - Nova assinatura criada para o usuário ${userId} com ID ${subscriptionId}`);
      } else {
        console.error(`[WEBHOOK] ${webhookEventId} - Usuário não encontrado para o customer ID:`, subscriptionDetails.customer);
        
        // Registrar o erro
        await db.collection('asaas_events').insertOne({
          webhook_id: webhookEventId,
          event_type: eventType,
          subscription_id: subscriptionId,
          payment_id: paymentId,
          customer_id: subscriptionDetails.customer,
          event_data: webhookData,
          error: `Usuário não encontrado para o customer ID: ${subscriptionDetails.customer}`,
          status: 'error',
          created_at: new Date()
        });
      }
    }
    
    // Processar eventos
    let status, endDate;
    
    switch (eventType) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        status = 'active';
        // Atualizar data de expiração com base no ciclo da assinatura
        if (subscriptionDetails) {
          const expirationDate = calculateExpirationDate(subscriptionDetails.cycle);
          
          // Atualizar ou criar assinatura
          await updateOrCreateSubscription(db, subscriptionId, {
            status,
            expirationDate,
            updated_at: new Date(),
            status_history: {
              status: status,
              timestamp: new Date(),
              source: eventType
            }
          }, subscriptionDetails, webhookEventId);
          
          console.log(`[WEBHOOK] ${webhookEventId} - Assinatura ${subscriptionId} ativada até ${expirationDate}`);
        } else {
          // Caso não consiga buscar detalhes, apenas atualizar status
          await updateSubscriptionStatus(db, subscriptionId, status, null, eventType, webhookEventId);
        }
        break;
        
      case 'PAYMENT_OVERDUE':
        status = 'overdue';
        await updateSubscriptionStatus(db, subscriptionId, status, null, eventType, webhookEventId);
        break;
        
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_REQUESTED':
      case 'SUBSCRIPTION_CANCELLED':
        status = 'canceled';
        endDate = new Date();
        await updateSubscriptionStatus(db, subscriptionId, status, endDate, eventType, webhookEventId);
        break;
        
      case 'SUBSCRIPTION_CREATED':
      case 'SUBSCRIPTION_RENEWED':
        if (subscriptionDetails && subscriptionDetails.status === 'ACTIVE') {
          status = 'active';
          const expirationDate = calculateExpirationDate(subscriptionDetails.cycle);
          await updateSubscriptionStatus(db, subscriptionId, status, null, eventType, webhookEventId);
          console.log(`[WEBHOOK] ${webhookEventId} - Assinatura ${subscriptionId} ativada/renovada até ${expirationDate}`);
        }
        break;
        
      default:
        console.log(`[WEBHOOK] ${webhookEventId} - Evento não processado: ${eventType}`);
        
        // Registrar evento não processado
        await db.collection('asaas_events').insertOne({
          webhook_id: webhookEventId,
          event_type: eventType,
          subscription_id: subscriptionId,
          payment_id: paymentId,
          event_data: webhookData,
          status: 'unprocessed',
          reason: 'Tipo de evento não reconhecido',
          created_at: new Date()
        });
        
        return res.status(200).json({ 
          success: true, 
          message: `Evento ${eventType} não requer atualização de status` 
        });
    }
    
    // Registrar evento processado
    await db.collection('processedWebhooks').insertOne({
      webhook_id: webhookEventId,
      event: webhookData,
      processed_at: new Date(),
      event_type: eventType,
      subscription_id: subscriptionId,
      payment_id: paymentId,
      status: 'processed'
    });
    
    console.log(`[WEBHOOK] ${webhookEventId} - Evento ${eventType} processado com sucesso`);
    
    return res.status(200).json({ 
      success: true, 
      message: `Evento ${eventType} processado com sucesso`,
      webhook_id: webhookEventId
    });
  } catch (error) {
    console.error(`[WEBHOOK] ${webhookEventId} - Erro ao processar webhook do Asaas:`, error);
    
    // Registrar o erro no banco de dados, se possível
    if (client) {
      try {
        const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
        await db.collection('asaas_events').insertOne({
          webhook_id: webhookEventId,
          error: error.message,
          stack: error.stack,
          event_data: req.body,
          status: 'error',
          created_at: new Date()
        });
      } catch (dbError) {
        console.error(`[WEBHOOK] ${webhookEventId} - Erro ao registrar erro no banco de dados:`, dbError);
      }
    }
    
    return res.status(500).json({ 
      error: 'Erro interno do servidor', 
      message: error.message,
      webhook_id: webhookEventId
    });
  } finally {
    if (client) {
      await client.close();
      console.log(`[WEBHOOK] ${webhookEventId} - Conexão com MongoDB fechada`);
    }
  }
};

/**
 * Calcula a data de expiração com base no ciclo da assinatura
 * @param {string} cycle - Ciclo de cobrança (MONTHLY, QUARTERLY, YEARLY)
 * @returns {Date} Data de expiração
 */
function calculateExpirationDate(cycle) {
  const expirationDate = new Date();
  
  switch (cycle) {
    case 'MONTHLY':
    case 'monthly':
      expirationDate.setMonth(expirationDate.getMonth() + 1);
      break;
    case 'QUARTERLY':
    case 'quarterly':
      expirationDate.setMonth(expirationDate.getMonth() + 3);
      break;
    case 'YEARLY':
    case 'yearly':
    case 'annual':
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      break;
    default:
      // Padrão de 30 dias se o ciclo não for reconhecido
      expirationDate.setDate(expirationDate.getDate() + 30);
  }
  
  return expirationDate;
}

/**
 * Atualiza o status de uma assinatura
 * @param {Db} db - Instância do banco de dados
 * @param {string} subscriptionId - ID da assinatura
 * @param {string} status - Novo status
 * @param {Date} endDate - Data de término (opcional)
 * @param {string} eventSource - Fonte do evento que gerou a atualização
 * @param {string} webhookEventId - ID do evento de webhook
 */
async function updateSubscriptionStatus(db, subscriptionId, status, endDate, eventSource, webhookEventId) {
  // Preparar dados para atualização
  const updateData = {
    status,
    updated_at: new Date()
  };
  
  if (endDate) {
    updateData.end_date = endDate;
  }
  
  // Atualizar assinatura por subscription_id ou payment_id
  const query = { $or: [{ subscription_id: subscriptionId }, { payment_id: subscriptionId }] };
  
  console.log(`[WEBHOOK] ${webhookEventId} - Atualizando status da assinatura para ${status}`);
  
  const result = await db.collection('subscriptions').updateOne(
    query,
    { 
      $set: updateData,
      $push: { 
        status_history: {
          status: status,
          timestamp: new Date(),
          source: eventSource || "webhook_update",
          webhook_id: webhookEventId
        }
      }
    }
  );
  
  // Atualizar também no formato antigo, se existir
  const legacyResult = await db.collection('assinaturas').updateOne(
    { 'asaas.id': subscriptionId },
    { $set: { 
      status: status === 'active' ? 'ativa' : status === 'overdue' ? 'atrasada' : 'cancelada',
      validade: endDate || null,
      atualizado: new Date()
    }}
  );
  
  console.log(`[WEBHOOK] ${webhookEventId} - Assinatura ${subscriptionId} atualizada para ${status}. Registros atualizados: ${result.modifiedCount + legacyResult.modifiedCount}`);
  
  // Se a atualização foi bem-sucedida, notificar o usuário
  if (result.modifiedCount > 0 || legacyResult.modifiedCount > 0) {
    // Buscar o ID do usuário
    const subscription = await db.collection('subscriptions').findOne({ 
      $or: [{ subscription_id: subscriptionId }, { payment_id: subscriptionId }] 
    });
    const legacySubscription = await db.collection('assinaturas').findOne({ 'asaas.id': subscriptionId });
    
    const userId = subscription?.user_id || legacySubscription?.usuario;
    
    if (userId) {
      // Adicionar notificação
      const notificationTitle = status === 'active' 
        ? 'Pagamento confirmado' 
        : status === 'overdue' 
          ? 'Pagamento atrasado' 
          : 'Assinatura cancelada';
      
      const notificationMessage = status === 'active' 
        ? 'Seu pagamento foi confirmado e sua assinatura está ativa.' 
        : status === 'overdue' 
          ? 'Seu pagamento está atrasado. Por favor, regularize para manter seu acesso.' 
          : 'Sua assinatura foi cancelada.';
      
      await db.collection('notifications').insertOne({
        user_id: userId,
        title: notificationTitle,
        message: notificationMessage,
        type: status === 'active' ? 'success' : status === 'overdue' ? 'warning' : 'error',
        read: false,
        created_at: new Date(),
        webhook_id: webhookEventId
      });
      
      console.log(`[WEBHOOK] ${webhookEventId} - Notificação enviada para o usuário ${userId}`);
    }
  } else {
    console.log(`[WEBHOOK] ${webhookEventId} - Nenhuma assinatura foi atualizada. Assinatura não encontrada: ${subscriptionId}`);
  }
}

/**
 * Busca o ID do usuário a partir do customer ID do Asaas
 * @param {Db} db - Instância do banco de dados 
 * @param {string} customerId - ID do cliente no Asaas
 * @returns {string|null} ID do usuário ou null se não encontrado
 */
async function getUserIdFromAsaasCustomer(db, customerId) {
  // Buscar em usuários MongoDB
  const user = await db.collection('users').findOne({
    $or: [
      { asaasCustomerId: customerId },
      { 'asaas.customerId': customerId }
    ]
  });
  
  return user ? user._id.toString() : null;
}

/**
 * Mapeia o tipo de plano com base no valor e ciclo
 * @param {number} value - Valor da assinatura
 * @param {string} cycle - Ciclo de cobrança
 * @returns {string} Identificador do plano
 */
function mapPlanType(value, cycle) {
  // Mapeamento básico com base no valor e ciclo
  if (cycle === 'MONTHLY' || cycle === 'monthly') {
    if (value <= 30) return 'basic';
    if (value <= 60) return 'pro';
    return 'premium';
  } else if (cycle === 'QUARTERLY' || cycle === 'quarterly') {
    return 'pro';
  } else if (cycle === 'YEARLY' || cycle === 'yearly' || cycle === 'annual') {
    return 'premium';
  }
  
  // Mapeamento baseado no valor (ajustar conforme necessário)
  if (value <= 30) {
    return 'basic';
  } else if (value <= 80) {
    return 'pro';
  } else {
    return 'premium';
  }
}

/**
 * Atualiza ou cria uma assinatura com base nos detalhes
 * @param {Db} db - Instância do banco de dados
 * @param {string} subscriptionId - ID da assinatura
 * @param {Object} updateData - Dados para atualizar
 * @param {Object} subscriptionDetails - Detalhes da assinatura do Asaas
 * @param {string} webhookEventId - ID do evento de webhook
 */
async function updateOrCreateSubscription(db, subscriptionId, updateData, subscriptionDetails, webhookEventId) {
  // Buscar assinatura existente
  const query = { $or: [{ subscription_id: subscriptionId }, { payment_id: subscriptionId }] };
  const existingSubscription = await db.collection('subscriptions').findOne(query);
  
  if (existingSubscription) {
    console.log(`[WEBHOOK] ${webhookEventId} - Atualizando assinatura existente: ${subscriptionId}`);
    
    // Atualizar assinatura existente
    await db.collection('subscriptions').updateOne(
      query,
      { 
        $set: updateData,
        $push: { 
          status_history: updateData.status_history
        }
      }
    );
  } else {
    console.log(`[WEBHOOK] ${webhookEventId} - Criando nova assinatura: ${subscriptionId}`);
    
    // Buscar usuário pelo customer ID
    const userId = await getUserIdFromAsaasCustomer(db, subscriptionDetails.customer);
    
    if (!userId) {
      console.error(`[WEBHOOK] ${webhookEventId} - Usuário não encontrado para customer ID: ${subscriptionDetails.customer}`);
      throw new Error(`Usuário não encontrado para customer ID: ${subscriptionDetails.customer}`);
    }
    
    // Criar nova assinatura
    await db.collection('subscriptions').insertOne({
      subscription_id: subscriptionId,
      user_id: userId,
      payment_id: subscriptionId,
      customer_id: subscriptionDetails.customer,
      plan_id: mapPlanType(subscriptionDetails.value, subscriptionDetails.cycle),
      status: updateData.status,
      original_asaas_status: subscriptionDetails.status,
      expirationDate: updateData.expirationDate,
      billing_type: subscriptionDetails.billingType,
      value: subscriptionDetails.value,
      activationDate: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      status_history: [updateData.status_history]
    });
    
    console.log(`[WEBHOOK] ${webhookEventId} - Nova assinatura criada para o usuário ${userId}`);
  }
} 