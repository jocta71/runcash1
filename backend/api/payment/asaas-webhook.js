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
    const payment = webhookData.payment;
    
    if (!payment) {
      return res.status(400).json({ error: 'Dados de pagamento não fornecidos' });
    }
    
    // Obter ID da assinatura do pagamento
    const subscriptionId = payment.subscription;
    
    if (!subscriptionId) {
      console.log('[WEBHOOK] Pagamento não relacionado a uma assinatura', payment);
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
    
    // Buscar assinatura no MongoDB pelo payment_id
    const subscriptionData = await db.collection('subscriptions').findOne({
      payment_id: subscriptionId
    });
    
    // Se a assinatura não existir no banco, mas existir no Asaas, criar novo registro
    if (!subscriptionData && subscriptionDetails) {
      // Buscar usuário pelo customer ID no Asaas
      const userId = await getUserIdFromAsaasCustomer(db, subscriptionDetails.customer);
      
      if (userId) {
        // Criar nova assinatura no banco
        await db.collection('subscriptions').insertOne({
          user_id: userId,
          payment_id: subscriptionId,
          plan_id: mapPlanType(subscriptionDetails.value, subscriptionDetails.cycle),
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
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
        status = 'active';
        // Atualizar data de expiração com base no ciclo da assinatura
        if (subscriptionDetails) {
          const expirationDate = calculateExpirationDate(subscriptionDetails.cycle);
          
          // Atualizar ou criar assinatura
          await updateOrCreateSubscription(db, subscriptionId, {
            status,
            expirationDate,
            updated_at: new Date()
          }, subscriptionDetails);
          
          console.log(`[WEBHOOK] Assinatura ${subscriptionId} ativada até ${expirationDate}`);
        } else {
          // Caso não consiga buscar detalhes, apenas atualizar status
          await updateSubscriptionStatus(db, subscriptionId, status);
        }
        break;
        
      case 'PAYMENT_OVERDUE':
        status = 'overdue';
        await updateSubscriptionStatus(db, subscriptionId, status);
        break;
        
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_REQUESTED':
      case 'SUBSCRIPTION_CANCELLED':
        status = 'canceled';
        endDate = new Date();
        await updateSubscriptionStatus(db, subscriptionId, status, endDate);
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
 * Atualiza o status de uma assinatura
 * @param {Db} db - Instância do banco de dados
 * @param {string} subscriptionId - ID da assinatura
 * @param {string} status - Novo status
 * @param {Date} endDate - Data de término (opcional)
 */
async function updateSubscriptionStatus(db, subscriptionId, status, endDate) {
  // Preparar dados para atualização
  const updateData = {
    status,
    updated_at: new Date()
  };
  
  if (endDate) {
    updateData.end_date = endDate;
  }
  
  // Atualizar assinatura
  const result = await db.collection('subscriptions').updateOne(
    { payment_id: subscriptionId },
    { $set: updateData }
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
  
  console.log(`[WEBHOOK] Assinatura ${subscriptionId} atualizada para ${status}. Registros atualizados: ${result.modifiedCount + legacyResult.modifiedCount}`);
  
  // Atualizar a coleção userSubscriptions com base no novo status
  try {
    const existingUserSubscription = await db.collection('userSubscriptions').findOne({
      asaasSubscriptionId: subscriptionId
    });
    
    if (existingUserSubscription) {
      // Sempre atualizar o status na coleção userSubscriptions
      await db.collection('userSubscriptions').updateOne(
        { asaasSubscriptionId: subscriptionId },
        { 
          $set: {
            status: status === 'active' ? 'active' : 
                   status === 'overdue' ? 'overdue' : 'inactive',
            updatedAt: new Date()
          }
        }
      );
      console.log(`[WEBHOOK] Status atualizado na coleção userSubscriptions para: ${status === 'active' ? 'active' : status === 'overdue' ? 'overdue' : 'inactive'}`);
    }
  } catch (error) {
    console.error(`[WEBHOOK] Erro ao atualizar status na coleção userSubscriptions: ${error.message}`);
  }
  
  // Se a atualização foi bem-sucedida, verificar se precisamos atualizar a coleção userSubscriptions
  if ((result.modifiedCount > 0 || legacyResult.modifiedCount > 0) && status === 'active') {
    // Buscar o ID do usuário e detalhes da assinatura
    const subscription = await db.collection('subscriptions').findOne({ payment_id: subscriptionId });
    
    if (subscription) {
      // Buscar se já existe um registro na coleção userSubscriptions
      const existingUserSubscription = await db.collection('userSubscriptions').findOne({
        asaasSubscriptionId: subscriptionId
      });
      
      // Buscar o customerId associado ao usuário
      const user = await db.collection('users').findOne({ _id: subscription.user_id });
      const customerId = user?.asaasCustomerId || user?.['asaas']?.customerId;
      
      if (customerId) {
        if (existingUserSubscription) {
          // Atualizar o registro existente
          await db.collection('userSubscriptions').updateOne(
            { asaasSubscriptionId: subscriptionId },
            { 
              $set: {
                status: 'active',
                updatedAt: new Date(),
                nextDueDate: subscription.expirationDate || calculateExpirationDate(subscription.plan_id === 'BASIC' ? 'MONTHLY' : subscription.plan_id === 'PRO' ? 'QUARTERLY' : 'YEARLY')
              }
            }
          );
          console.log(`[WEBHOOK] Registro existente atualizado na coleção userSubscriptions para a assinatura ${subscriptionId}`);
        } else {
          // Determinar o tipo de plano com base no plan_id
          let planType = 'basic';
          if (subscription.plan_id === 'PRO') planType = 'pro';
          if (subscription.plan_id === 'PREMIUM') planType = 'premium';
          
          // Criar novo registro na coleção userSubscriptions
          const userSubscription = {
            userId: subscription.user_id,
            asaasCustomerId: customerId,
            asaasSubscriptionId: subscriptionId,
            status: 'active',
            planType: planType.toLowerCase(),
            nextDueDate: subscription.expirationDate || calculateExpirationDate(planType === 'basic' ? 'MONTHLY' : planType === 'pro' ? 'QUARTERLY' : 'YEARLY'),
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await db.collection('userSubscriptions').insertOne(userSubscription);
          console.log(`[WEBHOOK] Novo registro criado na coleção userSubscriptions para a assinatura ${subscriptionId}`);
        }
      } else {
        console.log(`[WEBHOOK] Não foi possível encontrar o customerId do usuário ${subscription.user_id}`);
      }
    }
  }
  
  // Se a atualização foi bem-sucedida, notificar o usuário
  if (result.modifiedCount > 0 || legacyResult.modifiedCount > 0) {
    // Buscar o ID do usuário
    const subscription = await db.collection('subscriptions').findOne({ payment_id: subscriptionId });
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
        created_at: new Date()
      });
    }
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
    return 'BASIC';
  } else if (cycle === 'QUARTERLY' || cycle === 'quarterly') {
    return 'PRO';
  } else if (cycle === 'YEARLY' || cycle === 'yearly' || cycle === 'annual') {
    return 'PREMIUM';
  }
  
  // Mapeamento baseado no valor (ajustar conforme necessário)
  if (value <= 30) {
    return 'BASIC';
  } else if (value <= 80) {
    return 'PRO';
  } else {
    return 'PREMIUM';
  }
}

/**
 * Atualiza ou cria uma assinatura com base nos detalhes
 * @param {Db} db - Instância do banco de dados
 * @param {string} subscriptionId - ID da assinatura
 * @param {Object} updateData - Dados para atualizar
 * @param {Object} subscriptionDetails - Detalhes da assinatura do Asaas
 */
async function updateOrCreateSubscription(db, subscriptionId, updateData, subscriptionDetails) {
  // Buscar assinatura existente
  const existingSubscription = await db.collection('subscriptions').findOne({
    payment_id: subscriptionId
  });
  
  let userId;
  let customerId = subscriptionDetails.customer;
  let planId;
  
  if (existingSubscription) {
    // Atualizar assinatura existente
    await db.collection('subscriptions').updateOne(
      { payment_id: subscriptionId },
      { $set: updateData }
    );
    
    userId = existingSubscription.user_id;
    planId = existingSubscription.plan_id;
  } else {
    // Buscar usuário pelo customer ID
    userId = await getUserIdFromAsaasCustomer(db, subscriptionDetails.customer);
    
    if (!userId) {
      throw new Error(`Usuário não encontrado para customer ID: ${subscriptionDetails.customer}`);
    }
    
    // Determinar o tipo de plano
    planId = mapPlanType(subscriptionDetails.value, subscriptionDetails.cycle);
    
    // Criar nova assinatura
    await db.collection('subscriptions').insertOne({
      user_id: userId,
      payment_id: subscriptionId,
      plan_id: planId,
      status: updateData.status,
      expirationDate: updateData.expirationDate,
      activationDate: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });
  }
  
  // Atualizar a coleção userSubscriptions
  if (updateData.status === 'active') {
    try {
      // Buscar se já existe um registro
      const existingUserSubscription = await db.collection('userSubscriptions').findOne({
        asaasSubscriptionId: subscriptionId
      });
      
      // Determinar o tipo de plano para o formato da coleção userSubscriptions
      let planType = 'basic';
      if (planId === 'PRO') planType = 'pro';
      if (planId === 'PREMIUM') planType = 'premium';
      
      // Calcular próxima data de vencimento
      const nextDueDate = updateData.expirationDate || calculateExpirationDate(
        planType === 'basic' ? 'MONTHLY' : 
        planType === 'pro' ? 'QUARTERLY' : 'YEARLY'
      );
      
      if (existingUserSubscription) {
        // Atualizar registro existente
        await db.collection('userSubscriptions').updateOne(
          { asaasSubscriptionId: subscriptionId },
          { 
            $set: {
              status: 'active',
              nextDueDate: nextDueDate,
              updatedAt: new Date()
            }
          }
        );
        console.log(`[WEBHOOK] Registro atualizado na coleção userSubscriptions para a assinatura ${subscriptionId}`);
      } else {
        // Criar novo registro
        const userSubscription = {
          userId: userId,
          asaasCustomerId: customerId,
          asaasSubscriptionId: subscriptionId,
          status: 'active',
          planType: planType.toLowerCase(),
          nextDueDate: nextDueDate,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await db.collection('userSubscriptions').insertOne(userSubscription);
        console.log(`[WEBHOOK] Novo registro criado na coleção userSubscriptions para a assinatura ${subscriptionId}`);
      }
    } catch (error) {
      console.error(`[WEBHOOK] Erro ao atualizar a coleção userSubscriptions: ${error.message}`);
    }
  }
} 