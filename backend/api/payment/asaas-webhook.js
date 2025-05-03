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
    
    // Verificar se é um evento de assinatura direta (não via pagamento)
    if (eventType === 'SUBSCRIPTION_CREATED' || eventType === 'SUBSCRIPTION_UPDATED') {
      if (webhookData.subscription) {
        console.log('[WEBHOOK] Processando evento de assinatura direto:', eventType);
        
        const subscriptionId = webhookData.subscription.id;
        const customerId = webhookData.subscription.customer;
        
        // Buscar usuário pelo customer ID
        const userId = await getUserIdFromAsaasCustomer(db, customerId);
        
        if (userId) {
          // Verificar se já existe um registro na coleção userSubscriptions
          const userSubscription = await db.collection('userSubscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          const subscriptionStatus = webhookData.subscription.status === 'ACTIVE' ? 'active' : 'pending';
          
          if (!userSubscription) {
            // Criar novo registro em userSubscriptions
            console.log(`[WEBHOOK] Criando registro em userSubscriptions para evento ${eventType}`);
            
            await db.collection('userSubscriptions').insertOne({
              userId: userId,
              user_id: userId,
              asaasCustomerId: customerId,
              customer_id: customerId,
              asaasSubscriptionId: subscriptionId,
              status: subscriptionStatus,
              planType: mapPlanType(webhookData.subscription.value, webhookData.subscription.cycle),
              nextDueDate: new Date(webhookData.subscription.nextDueDate),
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            console.log(`[WEBHOOK] Registro criado com sucesso em userSubscriptions para evento ${eventType}`);
          } else {
            // Atualizar registro existente
            console.log(`[WEBHOOK] Atualizando registro existente em userSubscriptions: ${userSubscription._id}`);
            
            await db.collection('userSubscriptions').updateOne(
              { asaasSubscriptionId: subscriptionId },
              { 
                $set: {
                  status: subscriptionStatus,
                  nextDueDate: new Date(webhookData.subscription.nextDueDate),
                  updatedAt: new Date()
                }
              }
            );
          }
          
          // Verificar e criar/atualizar na coleção subscriptions também
          const subscription = await db.collection('subscriptions').findOne({
            payment_id: subscriptionId
          });
          
          if (!subscription) {
            // Criar novo registro
            await db.collection('subscriptions').insertOne({
              user_id: userId,
              payment_id: subscriptionId,
              customer_id: customerId,
              plan_id: mapPlanType(webhookData.subscription.value, webhookData.subscription.cycle),
              status: subscriptionStatus,
              created_at: new Date(),
              updated_at: new Date()
            });
          } else {
            // Atualizar registro existente
            await db.collection('subscriptions').updateOne(
              { payment_id: subscriptionId },
              { 
                $set: {
                  status: subscriptionStatus,
                  updated_at: new Date()
                }
              }
            );
          }
        } else {
          console.error(`[WEBHOOK] Usuário não encontrado para customer ID: ${customerId}`);
        }
        
        return res.status(200).json({
          success: true,
          message: `Evento ${eventType} processado com sucesso`
        });
      } else {
        console.error('[WEBHOOK] Evento de assinatura sem dados da assinatura');
        return res.status(400).json({ error: 'Dados da assinatura não fornecidos' });
      }
    }
    
    // Se não for um evento de assinatura direta, processar como evento de pagamento
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
          
          // Verificar se a assinatura já existe antes de tentar atualizar
          console.log(`[WEBHOOK] [DEBUG] Verificando se existe assinatura para ${subscriptionId} antes da atualização`);
          const existingSubscription = await db.collection('subscriptions').findOne({
            payment_id: subscriptionId
          });
          
          if (existingSubscription) {
            console.log(`[WEBHOOK] [DEBUG] Encontrada assinatura existente, atualizando status de '${existingSubscription.status}' para 'active'`);
            
            // Atualizar diretamente sem usar a função que pode estar com problema
            const updateResult = await db.collection('subscriptions').updateOne(
              { payment_id: subscriptionId },
              { 
                $set: {
                  status: 'active',
                  expirationDate: expirationDate,
                  updated_at: new Date()
                } 
              }
            );
            
            console.log(`[WEBHOOK] [DEBUG] Resultado da atualização direta: ${JSON.stringify(updateResult)}`);
          } else {
            // Se não existir, tentar criar uma nova assinatura
            console.log(`[WEBHOOK] [DEBUG] Assinatura não encontrada, tentando criar...`);
            
            // Usar a função updateOrCreateSubscription
            try {
              await updateOrCreateSubscription(db, subscriptionId, {
                status,
                expirationDate,
                updated_at: new Date()
              }, subscriptionDetails);
            } catch (error) {
              console.error(`[WEBHOOK] [DEBUG] Erro ao criar/atualizar assinatura: ${error.message}`);
            }
          }
          
          console.log(`[WEBHOOK] Assinatura ${subscriptionId} ativada até ${expirationDate}`);
          
          // Verificar se já existe registro na coleção userSubscriptions
          console.log(`[WEBHOOK] [DEBUG] Verificando userSubscriptions para ${subscriptionId}`);
          const userSubscription = await db.collection('userSubscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (!userSubscription) {
            // Buscar ID do usuário associado ao customer
            console.log(`[WEBHOOK] [DEBUG] userSubscription não encontrado, buscando usuário para ${subscriptionDetails.customer}`);
            const userId = await getUserIdFromAsaasCustomer(db, subscriptionDetails.customer);
            
            if (userId) {
              // Criar registro na coleção userSubscriptions
              const planType = mapPlanType(subscriptionDetails.value, subscriptionDetails.cycle);
              let nextDueDate;
              
              try {
                nextDueDate = new Date(subscriptionDetails.nextDueDate);
              } catch (error) {
                console.error(`[WEBHOOK] [DEBUG] Erro ao converter nextDueDate: ${error.message}`);
                nextDueDate = calculateExpirationDate(subscriptionDetails.cycle);
              }
              
              console.log(`[WEBHOOK] [DEBUG] Criando registro em userSubscriptions para usuário ${userId}`);
              
              try {
                const newSubscription = {
                  userId: userId,
                  user_id: userId, // Mantendo ambos os formatos para compatibilidade
                  asaasCustomerId: subscriptionDetails.customer,
                  customer_id: subscriptionDetails.customer, // Mantendo ambos os formatos para compatibilidade
                  asaasSubscriptionId: subscriptionId,
                  status: 'active',
                  planType: planType,
                  nextDueDate: nextDueDate,
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
                
                console.log(`[WEBHOOK] [DEBUG] Dados para inserção: ${JSON.stringify(newSubscription)}`);
                
                const insertResult = await db.collection('userSubscriptions').insertOne(newSubscription);
                
                console.log(`[WEBHOOK] [DEBUG] Registro criado com sucesso em userSubscriptions: ${JSON.stringify(insertResult)}`);
              } catch (error) {
                console.error(`[WEBHOOK] [DEBUG] Erro ao criar registro em userSubscriptions: ${error.message}`);
              }
            } else {
              console.error(`[WEBHOOK] [DEBUG] Não foi possível encontrar usuário para customer ID: ${subscriptionDetails.customer}`);
            }
          } else {
            console.log(`[WEBHOOK] [DEBUG] Registro já existe em userSubscriptions: ${userSubscription._id}, atualizando status`);
            
            try {
              const updateResult = await db.collection('userSubscriptions').updateOne(
                { asaasSubscriptionId: subscriptionId },
                { 
                  $set: {
                    status: 'active',
                    updatedAt: new Date()
                  } 
                }
              );
              
              console.log(`[WEBHOOK] [DEBUG] Atualização de userSubscriptions: ${JSON.stringify(updateResult)}`);
            } catch (error) {
              console.error(`[WEBHOOK] [DEBUG] Erro ao atualizar userSubscriptions: ${error.message}`);
            }
          }
        } else {
          // Caso não consiga buscar detalhes, apenas atualizar status
          console.log(`[WEBHOOK] [DEBUG] Sem detalhes da assinatura, apenas atualizando status`);
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
  console.log(`[WEBHOOK] [DEBUG] Buscando usuário pelo customerId: ${customerId}`);
  
  // Buscar em usuários MongoDB
  const user = await db.collection('users').findOne({
    $or: [
      { asaasCustomerId: customerId },
      { 'asaas.customerId': customerId }
    ]
  });
  
  if (user) {
    console.log(`[WEBHOOK] [DEBUG] Usuário encontrado: ${user._id.toString()}`);
  } else {
    console.log(`[WEBHOOK] [DEBUG] ERRO: Nenhum usuário encontrado com customerId: ${customerId}`);
    
    // Vamos verificar se existem usuários com algum asaasCustomerId para diagnóstico
    const usersWithAsaasId = await db.collection('users').find({
      asaasCustomerId: { $exists: true }
    }).limit(5).toArray();
    
    console.log(`[WEBHOOK] [DEBUG] Exemplos de usuários com asaasCustomerId:`);
    usersWithAsaasId.forEach(u => {
      console.log(`- ID: ${u._id}, asaasCustomerId: ${u.asaasCustomerId}`);
    });
  }
  
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
  console.log(`[WEBHOOK] [DEBUG] Atualizando/criando assinatura: ${subscriptionId}`);
  console.log(`[WEBHOOK] [DEBUG] Dados: ${JSON.stringify(updateData)}`);
  
  // Buscar assinatura existente
  const existingSubscription = await db.collection('subscriptions').findOne({
    payment_id: subscriptionId
  });
  
  if (existingSubscription) {
    console.log(`[WEBHOOK] [DEBUG] Assinatura existente encontrada: ${JSON.stringify(existingSubscription)}`);
    
    // Atualizar assinatura existente
    const updateResult = await db.collection('subscriptions').updateOne(
      { payment_id: subscriptionId },
      { $set: updateData }
    );
    
    console.log(`[WEBHOOK] [DEBUG] Resultado da atualização: ${JSON.stringify(updateResult)}`);
  } else {
    console.log(`[WEBHOOK] [DEBUG] Assinatura não encontrada, criando nova...`);
    
    // Buscar usuário pelo customer ID
    const userId = await getUserIdFromAsaasCustomer(db, subscriptionDetails.customer);
    
    if (!userId) {
      console.error(`[WEBHOOK] [DEBUG] ERRO CRÍTICO: Usuário não encontrado para customer ID: ${subscriptionDetails.customer}`);
      throw new Error(`Usuário não encontrado para customer ID: ${subscriptionDetails.customer}`);
    }
    
    // Criar nova assinatura
    const subscriptionData = {
      user_id: userId,
      payment_id: subscriptionId,
      plan_id: mapPlanType(subscriptionDetails.value, subscriptionDetails.cycle),
      customer_id: subscriptionDetails.customer, // Adicionar customer_id para facilitar buscas
      status: updateData.status,
      expirationDate: updateData.expirationDate,
      activationDate: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };
    
    console.log(`[WEBHOOK] [DEBUG] Inserindo nova assinatura: ${JSON.stringify(subscriptionData)}`);
    
    const insertResult = await db.collection('subscriptions').insertOne(subscriptionData);
    console.log(`[WEBHOOK] [DEBUG] Resultado da inserção: ${JSON.stringify(insertResult)}`);
  }
} 