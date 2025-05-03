const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configurações da API Asaas
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

console.log(`[WEBHOOK] Usando Asaas em ambiente: ${ASAAS_ENVIRONMENT}`);

/**
 * Busca detalhes completos de uma assinatura
 * @param {string} subscriptionId - ID da assinatura no Asaas
 * @returns {Promise<Object>} Detalhes da assinatura
 */
async function getSubscriptionDetails(subscriptionId) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/subscriptions/${subscriptionId}`,
      { headers: { 'access_token': ASAAS_API_KEY } }
    );
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar detalhes da assinatura:', error.message);
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
    return res.status(200).json({ 
      status: 'Webhook endpoint ativo. Use POST para eventos do Asaas.',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', method: req.method });
  }

  let client;

  try {
    // Extrair dados do webhook
    const webhookData = req.body;
    console.log('[WEBHOOK] Evento recebido do Asaas:', JSON.stringify(webhookData, null, 2));
    
    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    // Registrar o log do webhook
    await db.collection('webhook_logs').insertOne({
      provider: 'asaas',
      event_type: webhookData.event,
      payload: webhookData,
      created_at: new Date()
    });
    
    // Processar diferentes tipos de eventos
    const eventType = webhookData.event;
    const payment = webhookData.payment || webhookData.subscription || {};
    
    // Se for um evento relacionado diretamente à assinatura (não ao pagamento)
    if (webhookData.subscription && !payment.subscription) {
      payment.subscription = webhookData.subscription.id;
    }
    
    if (!payment || (!payment.id && !payment.subscription)) {
      return res.status(400).json({ error: 'Dados de pagamento ou assinatura não fornecidos' });
    }
    
    // Obter ID da assinatura do pagamento ou diretamente do evento
    const subscriptionId = payment.subscription || payment.id;
    
    if (!subscriptionId) {
      console.log('[WEBHOOK] Evento não relacionado a uma assinatura', payment);
      return res.status(200).json({ message: 'Evento ignorado - não é uma assinatura' });
    }
    
    // Buscar detalhes da assinatura no Asaas
    let subscriptionDetails;
    try {
      subscriptionDetails = await getSubscriptionDetails(subscriptionId);
      console.log('[WEBHOOK] Detalhes da assinatura:', JSON.stringify(subscriptionDetails, null, 2));
    } catch (error) {
      console.error('[WEBHOOK] Erro ao buscar detalhes da assinatura:', error.message);
    }
    
    // Buscar assinatura no MongoDB pelo subscription_id
    const subscriptionData = await db.collection('subscriptions').findOne({
      subscription_id: subscriptionId
    });
    
    // Se a assinatura não existir no banco, mas existir no Asaas, criar novo registro
    if (!subscriptionData && subscriptionDetails) {
      // Buscar usuário pelo customer ID no Asaas
      const userId = await getUserIdFromAsaasCustomer(db, subscriptionDetails.customer);
      
      if (userId) {
        const planId = mapPlanType(subscriptionDetails.value, subscriptionDetails.cycle);
        const status = 'pending';
        
        // Criar nova assinatura na coleção subscriptions
        await db.collection('subscriptions').insertOne({
          subscription_id: subscriptionId,
          user_id: userId,
          customer_id: subscriptionDetails.customer,
          plan_id: planId,
          payment_id: payment.id || '',
          status: status,
          original_asaas_status: subscriptionDetails.status,
          billing_type: subscriptionDetails.billingType,
          value: subscriptionDetails.value,
          created_at: new Date(),
          status_history: [
            {
              status: status,
              timestamp: new Date(),
              source: 'webhook_initial_creation'
            }
          ]
        });
        
        // Criar entrada na coleção userSubscriptions
        await db.collection('userSubscriptions').insertOne({
          userId: userId,
          asaasCustomerId: subscriptionDetails.customer,
          asaasSubscriptionId: subscriptionId,
          status: status,
          planType: planId,
          nextDueDate: calculateExpirationDate(subscriptionDetails.cycle),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`[WEBHOOK] Nova assinatura criada para o usuário ${userId} com ID ${subscriptionId}`);
      } else {
        console.error('[WEBHOOK] Usuário não encontrado para o customer ID:', subscriptionDetails.customer);
      }
    }
    
    // Processar eventos
    let status, endDate;
    
    switch (eventType) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
      case 'SUBSCRIPTION_RENEWED':
      case 'SUBSCRIPTION_ACTIVATED':
        status = 'active';
        // Atualizar data de expiração com base no ciclo da assinatura
        if (subscriptionDetails) {
          const expirationDate = calculateExpirationDate(subscriptionDetails.cycle);
          
          // Atualizar ou criar assinatura
          await updateSubscriptionsInAllCollections(db, subscriptionId, {
            status,
            expirationDate,
            updated_at: new Date()
          }, subscriptionDetails);
          
          console.log(`[WEBHOOK] Assinatura ${subscriptionId} ativada até ${expirationDate}`);
        } else {
          // Caso não consiga buscar detalhes, apenas atualizar status
          await updateSubscriptionsInAllCollections(db, subscriptionId, { status });
        }
        break;
        
      case 'PAYMENT_OVERDUE':
        status = 'overdue';
        await updateSubscriptionsInAllCollections(db, subscriptionId, { status });
        break;
        
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_REQUESTED':
      case 'SUBSCRIPTION_CANCELLED':
      case 'SUBSCRIPTION_ENDED':
        status = 'canceled';
        endDate = new Date();
        await updateSubscriptionsInAllCollections(db, subscriptionId, { 
          status, 
          endDate,
          canceledAt: endDate
        });
        break;
        
      default:
        console.log(`[WEBHOOK] Evento não processado: ${eventType}`);
        return res.status(200).json({ 
          success: true, 
          message: `Evento ${eventType} não requer atualização de status` 
        });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: `Evento ${eventType} processado com sucesso` 
    });
  } catch (error) {
    console.error('[WEBHOOK] Erro ao processar webhook do Asaas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) {
      await client.close();
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
 * Atualiza o status de uma assinatura em todas as coleções relevantes
 * @param {Db} db - Instância do banco de dados
 * @param {string} subscriptionId - ID da assinatura
 * @param {Object} updateData - Dados para atualização
 * @param {Object} subscriptionDetails - Detalhes da assinatura (opcional)
 */
async function updateSubscriptionsInAllCollections(db, subscriptionId, updateData, subscriptionDetails = null) {
  const { status, expirationDate, endDate, canceledAt } = updateData;
  
  // Atualização para a coleção 'subscriptions'
  const subscriptionUpdate = {
    status,
    updated_at: new Date()
  };
  
  if (subscriptionDetails) {
    subscriptionUpdate.original_asaas_status = subscriptionDetails.status;
  }
  
  if (expirationDate) {
    subscriptionUpdate.expiration_date = expirationDate;
  }
  
  if (endDate) {
    subscriptionUpdate.end_date = endDate;
  }
  
  // Registrar na history
  const historyEntry = {
    status,
    timestamp: new Date(),
    source: 'webhook'
  };
  
  // Atualizar coleção subscriptions
  const result = await db.collection('subscriptions').updateOne(
    { subscription_id: subscriptionId },
    { 
      $set: subscriptionUpdate,
      $push: { status_history: historyEntry }
    }
  );
  
  // Atualização para a coleção 'userSubscriptions'
  const userSubscriptionUpdate = {
    status,
    updatedAt: new Date()
  };
  
  if (expirationDate) {
    userSubscriptionUpdate.nextDueDate = expirationDate;
  }
  
  if (canceledAt) {
    userSubscriptionUpdate.canceledAt = canceledAt;
  }
  
  // Atualizar coleção userSubscriptions
  const userSubResult = await db.collection('userSubscriptions').updateOne(
    { asaasSubscriptionId: subscriptionId },
    { $set: userSubscriptionUpdate }
  );
  
  // Atualizar também no formato antigo, se existir
  const legacyResult = await db.collection('assinaturas').updateOne(
    { 'asaas.id': subscriptionId },
    { $set: { 
      status, 
      updated_at: new Date(),
      ...(endDate ? { end_date: endDate } : {})
    }}
  );
  
  console.log(`[WEBHOOK] Assinatura ${subscriptionId} atualizada para ${status}. Registros atualizados: coleção subscriptions=${result.modifiedCount}, coleção userSubscriptions=${userSubResult.modifiedCount}, coleção legacy=${legacyResult.modifiedCount}`);
  
  return {
    result,
    userSubResult,
    legacyResult
  };
}

/**
 * Busca o ID do usuário a partir do ID do cliente no Asaas
 * @param {Db} db - Instância do banco de dados
 * @param {string} customerId - ID do cliente no Asaas
 * @returns {Promise<string|null>} ID do usuário, ou null se não encontrado
 */
async function getUserIdFromAsaasCustomer(db, customerId) {
  // Tentar encontrar na coleção 'users'
  const user = await db.collection('users').findOne({ customerId });
  
  if (user) {
    return user._id.toString();
  }
  
  // Tentar encontrar no campo alternativo
  const userAlt = await db.collection('users').findOne({ customer_id: customerId });
  
  if (userAlt) {
    return userAlt._id.toString();
  }
  
  return null;
}

/**
 * Mapeia o valor do plano para o tipo de plano
 * @param {number} value - Valor do plano
 * @param {string} cycle - Ciclo de cobrança
 * @returns {string} Tipo do plano
 */
function mapPlanType(value, cycle) {
  if (!value) return 'basic';
  
  // Valores mensais
  if (cycle === 'MONTHLY' || cycle === 'monthly') {
    if (value <= 29.9) return 'basic';
    if (value <= 49.9) return 'pro';
    return 'premium';
  }
  
  // Valores trimestrais
  if (cycle === 'QUARTERLY' || cycle === 'quarterly') {
    if (value <= 79.9) return 'basic';
    if (value <= 139.9) return 'pro';
    return 'premium';
  }
  
  // Valores anuais
  if (cycle === 'YEARLY' || cycle === 'yearly' || cycle === 'annual') {
    if (value <= 299.9) return 'basic';
    if (value <= 499.9) return 'pro';
    return 'premium';
  }
  
  // Fallback para basic se não conseguir determinar
  return 'basic';
} 