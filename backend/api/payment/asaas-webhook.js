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
    console.log(`[WEBHOOK] Buscando detalhes da assinatura ${subscriptionId}`);
    const response = await axios.get(
      `${API_BASE_URL}/subscriptions/${subscriptionId}`,
      { headers: { 'access_token': ASAAS_API_KEY } }
    );
    return response.data;
  } catch (error) {
    console.error('[WEBHOOK] Erro ao buscar detalhes da assinatura:', error.message);
    
    // Tentar obter detalhes da resposta de erro para diagnóstico
    if (error.response) {
      console.error('[WEBHOOK] Resposta de erro da API Asaas:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    
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
      timestamp: new Date().toISOString(),
      environment: ASAAS_ENVIRONMENT
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
    
    // Responder rapidamente para o Asaas, para evitar retentativas desnecessárias
    // Processaremos o evento de forma assíncrona após a resposta
    const responsePromise = res.status(200).json({ 
      success: true, 
      message: 'Webhook recebido com sucesso',
      received_at: new Date().toISOString()
    });
    
    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log('[WEBHOOK] Conectado ao MongoDB');
    
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    // Registrar o log do webhook imediatamente
    await db.collection('webhook_logs').insertOne({
      provider: 'asaas',
      event_type: webhookData.event,
      payload: webhookData,
      created_at: new Date(),
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    });
    
    // Processar diferentes tipos de eventos
    const eventType = webhookData.event;
    const payment = webhookData.payment;
    
    if (!payment) {
      console.error('[WEBHOOK] Dados de pagamento não fornecidos');
      return responsePromise;
    }
    
    // Obter ID da assinatura do pagamento
    const subscriptionId = payment.subscription;
    
    if (!subscriptionId) {
      console.log('[WEBHOOK] Pagamento não relacionado a uma assinatura', payment);
      return responsePromise;
    }
    
    // Buscar detalhes da assinatura no Asaas
    let subscriptionDetails;
    try {
      subscriptionDetails = await getSubscriptionDetails(subscriptionId);
      console.log('[WEBHOOK] Detalhes da assinatura:', JSON.stringify(subscriptionDetails, null, 2));
    } catch (error) {
      console.error('[WEBHOOK] Erro ao buscar detalhes da assinatura:', error.message);
      // Continuar processamento mesmo sem detalhes completos
    }
    
    // Buscar assinatura no MongoDB pelo ID da assinatura
    const subscriptionData = await db.collection('subscriptions').findOne({
      payment_id: subscriptionId
    });
    
    console.log(`[WEBHOOK] Assinatura encontrada no banco: ${subscriptionData ? 'Sim' : 'Não'}`);
    
    // Se a assinatura não existir no banco, mas existir no Asaas, criar novo registro
    if (!subscriptionData && subscriptionDetails) {
      // Buscar usuário pelo customer ID no Asaas
      const userId = await getUserIdFromAsaasCustomer(db, subscriptionDetails.customer);
      
      if (userId) {
        console.log(`[WEBHOOK] Criando nova assinatura para o usuário ${userId} com ID ${subscriptionId}`);
        
        // Mapear o plano com base no valor e ciclo
        const planId = mapPlanType(subscriptionDetails.value, subscriptionDetails.cycle);
        
        // Calcular data de expiração com base no ciclo
        const expirationDate = calculateExpirationDate(subscriptionDetails.cycle);
        
        // Criar nova assinatura no banco
        await db.collection('subscriptions').insertOne({
          user_id: userId,
          payment_id: subscriptionId,
          plan_id: planId,
          status: 'pending',
          value: subscriptionDetails.value,
          cycle: subscriptionDetails.cycle,
          expirationDate: expirationDate,
          nextDueDate: subscriptionDetails.nextDueDate,
          asaas_customer_id: subscriptionDetails.customer,
          created_at: new Date(),
          updated_at: new Date()
        });
        
        console.log(`[WEBHOOK] Nova assinatura criada para o usuário ${userId} com ID ${subscriptionId}`);
        
        // Adicionar log específico de criação
        await db.collection('subscription_logs').insertOne({
          user_id: userId,
          subscription_id: subscriptionId,
          action: 'create',
          details: {
            plan_id: planId,
            value: subscriptionDetails.value,
            event_type: eventType,
            payment_id: payment.id
          },
          created_at: new Date()
        });
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
            value: subscriptionDetails.value,
            cycle: subscriptionDetails.cycle,
            nextDueDate: subscriptionDetails.nextDueDate,
            updated_at: new Date()
          }, subscriptionDetails);
          
          console.log(`[WEBHOOK] Assinatura ${subscriptionId} ativada até ${expirationDate}`);
          
          // Adicionar log específico de ativação
          const userId = subscriptionData?.user_id || 
                        (await getUserIdFromAsaasCustomer(db, subscriptionDetails.customer));
          
          if (userId) {
            await db.collection('subscription_logs').insertOne({
              user_id: userId,
              subscription_id: subscriptionId,
              action: 'activate',
              details: {
                expirationDate,
                event_type: eventType,
                payment_id: payment.id,
                plan_id: subscriptionData?.plan_id || mapPlanType(subscriptionDetails.value, subscriptionDetails.cycle)
              },
              created_at: new Date()
            });
          }
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
        break;
    }
    
    console.log(`[WEBHOOK] Processamento do webhook concluído para evento ${eventType}`);
    return responsePromise;
  } catch (error) {
    console.error('[WEBHOOK] Erro ao processar webhook do Asaas:', error);
    
    // Se ainda não respondemos, enviar uma resposta de erro
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Erro interno do servidor', 
        message: error.message 
      });
    }
  } finally {
    if (client) {
      try {
        await client.close();
        console.log('[WEBHOOK] Conexão com MongoDB fechada');
      } catch (err) {
        console.error('[WEBHOOK] Erro ao fechar conexão com MongoDB:', err);
      }
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
      expirationDate.setDate(expirationDate.getDate() + 3); // 3 dias de tolerância
      break;
    case 'QUARTERLY':
    case 'quarterly':
      expirationDate.setMonth(expirationDate.getMonth() + 3);
      expirationDate.setDate(expirationDate.getDate() + 5); // 5 dias de tolerância
      break;
    case 'YEARLY':
    case 'yearly':
    case 'annual':
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      expirationDate.setDate(expirationDate.getDate() + 7); // 7 dias de tolerância
      break;
    default:
      // Padrão de 30 dias se o ciclo não for reconhecido
      expirationDate.setDate(expirationDate.getDate() + 33); // 30 dias + 3 de tolerância
  }
  
  // Definir hora para final do dia
  expirationDate.setHours(23, 59, 59, 999);
  
  console.log(`[WEBHOOK] Data de expiração calculada: ${expirationDate.toISOString()} para ciclo ${cycle}`);
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
      
      // Registrar ação no log de assinaturas
      await db.collection('subscription_logs').insertOne({
        user_id: userId,
        subscription_id: subscriptionId,
        action: status === 'active' ? 'activate' : status === 'overdue' ? 'overdue' : 'cancel',
        created_at: new Date(),
        details: {
          status: status,
          end_date: endDate || null
        }
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
      { 'asaas.customerId': customerId },
      { 'asaas.id': customerId }
    ]
  });
  
  if (user) {
    return user._id.toString();
  }
  
  // Tentar buscar no formato antigo
  const legacyUser = await db.collection('usuarios').findOne({
    $or: [
      { 'asaas.customerId': customerId },
      { 'asaas.id': customerId }
    ]
  });
  
  return legacyUser ? legacyUser._id.toString() : null;
}

/**
 * Mapeia o tipo de plano com base no valor e ciclo
 * @param {number} value - Valor da assinatura
 * @param {string} cycle - Ciclo de cobrança
 * @returns {string} Identificador do plano
 */
function mapPlanType(value, cycle) {
  // Mapeamento com base no ciclo e valor
  if (cycle === 'YEARLY' || cycle === 'yearly' || cycle === 'annual') {
    return 'PREMIUM';
  } else if (cycle === 'QUARTERLY' || cycle === 'quarterly') {
    return 'PRO';
  } else if (cycle === 'MONTHLY' || cycle === 'monthly') {
    if (value >= 50) {
      return 'PRO';
    } else {
      return 'BASIC';
    }
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
  
  if (existingSubscription) {
    console.log(`[WEBHOOK] Atualizando assinatura existente: ${subscriptionId}`);
    
    // Atualizar assinatura existente
    const result = await db.collection('subscriptions').updateOne(
      { payment_id: subscriptionId },
      { $set: updateData }
    );
    
    console.log(`[WEBHOOK] Assinatura atualizada: ${result.modifiedCount} documento(s) modificado(s)`);
  } else {
    // Buscar usuário pelo customer ID
    const userId = await getUserIdFromAsaasCustomer(db, subscriptionDetails.customer);
    
    if (!userId) {
      console.error(`[WEBHOOK] Usuário não encontrado para customer ID: ${subscriptionDetails.customer}`);
      throw new Error(`Usuário não encontrado para customer ID: ${subscriptionDetails.customer}`);
    }
    
    console.log(`[WEBHOOK] Criando nova assinatura para usuário ${userId}`);
    
    // Criar nova assinatura
    const result = await db.collection('subscriptions').insertOne({
      user_id: userId,
      payment_id: subscriptionId,
      plan_id: mapPlanType(subscriptionDetails.value, subscriptionDetails.cycle),
      status: updateData.status,
      expirationDate: updateData.expirationDate,
      nextDueDate: subscriptionDetails.nextDueDate,
      value: subscriptionDetails.value,
      cycle: subscriptionDetails.cycle,
      asaas_customer_id: subscriptionDetails.customer,
      activationDate: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });
    
    console.log(`[WEBHOOK] Nova assinatura criada com _id: ${result.insertedId}`);
    
    // Registrar ação no log de assinaturas
    await db.collection('subscription_logs').insertOne({
      user_id: userId,
      subscription_id: subscriptionId,
      action: 'create_and_activate',
      created_at: new Date(),
      details: {
        plan_id: mapPlanType(subscriptionDetails.value, subscriptionDetails.cycle),
        status: updateData.status,
        expirationDate: updateData.expirationDate,
        value: subscriptionDetails.value
      }
    });
  }
} 