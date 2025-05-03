/**
 * Serviço para interação com a API do Asaas
 * Implementa funções para verificação de assinaturas e outros recursos
 */

const axios = require('axios');
const { MongoClient } = require('mongodb');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Configuração do Asaas API
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Variável para forçar verificação na API do Asaas (apenas para debugging)
const FORCE_ASAAS_CHECK = process.env.FORCE_ASAAS_CHECK === 'true';

/**
 * Verifica o status de uma assinatura pelo ID do cliente
 * Primeira verificação: banco de dados local
 * Segunda verificação (fallback): API do Asaas
 * 
 * @param {string} customerId - ID do cliente no Asaas
 * @returns {Promise<Object>} - Objeto com informações da assinatura
 */
async function checkSubscriptionStatus(customerId) {
  let client;
  
  try {
    // Primeiro, verificar no banco de dados local
    if (!FORCE_ASAAS_CHECK) {
      console.log(`[AsaasService] Verificando assinatura para cliente ${customerId} no banco de dados local`);
      
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      
      const db = client.db(MONGODB_DB_NAME);
      
      // 1. Verificar na coleção 'subscriptions'
      const subscription = await db.collection('subscriptions').findOne({ 
        customer_id: customerId,
        status: 'active'
      });
      
      if (subscription) {
        console.log(`[AsaasService] ✅ Assinatura ativa encontrada na coleção 'subscriptions'`);
        
        await client.close();
        client = null;
        
        return {
          success: true,
          message: 'Assinatura ativa encontrada no banco local',
          status: subscription.status,
          hasActiveSubscription: true,
          source: 'local_db_subscriptions'
        };
      }
      
      // 2. Verificar na coleção 'userSubscriptions'
      const userSubscription = await db.collection('userSubscriptions').findOne({ 
        asaasCustomerId: customerId,
        status: 'active'
      });
      
      if (userSubscription) {
        console.log(`[AsaasService] ✅ Assinatura ativa encontrada na coleção 'userSubscriptions'`);
        
        await client.close();
        client = null;
        
        return {
          success: true,
          message: 'Assinatura ativa encontrada no banco local',
          status: userSubscription.status,
          hasActiveSubscription: true,
          source: 'local_db_userSubscriptions'
        };
      }
      
      console.log(`[AsaasService] ⚠️ Nenhuma assinatura ativa encontrada no banco local, verificando na API Asaas...`);
    }
    
    // Se client ainda estiver conectado, feche a conexão
    if (client) {
      await client.close();
      client = null;
    }
    
    // Se não encontrar no banco ou se FORCE_ASAAS_CHECK for true, verificar na API do Asaas
    // Este é apenas um fallback quando webhooks falham ou para verificação inicial
    console.log(`[AsaasService] Verificando assinatura para cliente ${customerId} na API Asaas`);
    
    // Verificar se a chave da API está configurada
    if (!ASAAS_API_KEY) {
      console.error('[AsaasService] ❌ ASAAS_API_KEY não configurada');
      return {
        success: false,
        message: 'Chave da API Asaas não configurada',
        status: 'CONFIGURATION_ERROR',
        hasActiveSubscription: false
      };
    }
    
    const response = await axios.get(
      `${ASAAS_API_URL}/subscriptions?customer=${customerId}`, 
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    );
    
    // Verificar se a resposta contém assinaturas
    if (!response.data || !response.data.data || response.data.data.length === 0) {
      console.log(`[AsaasService] Nenhuma assinatura encontrada para o cliente: ${customerId}`);
      return {
        success: false,
        message: 'Nenhuma assinatura encontrada',
        status: 'NOT_FOUND',
        hasActiveSubscription: false
      };
    }
    
    // Procurar por uma assinatura ativa
    const activeSubscription = response.data.data.find(sub => 
      sub.status === 'ACTIVE' || sub.status === 'active'
    );
    
    if (!activeSubscription) {
      // Obter a assinatura mais recente
      const latestSubscription = response.data.data.sort((a, b) => 
        new Date(b.dateCreated) - new Date(a.dateCreated)
      )[0];
      
      console.log(`[AsaasService] Nenhuma assinatura ativa. Status mais recente: ${latestSubscription.status}`);
      
      // Como não encontramos uma assinatura ativa, vamos sincronizar o banco de dados
      await syncSubscriptionToDatabase(customerId, latestSubscription, false);
      
      return {
        success: true,
        message: 'Nenhuma assinatura ativa encontrada',
        status: latestSubscription.status,
        hasActiveSubscription: false,
        subscription: latestSubscription
      };
    }
    
    console.log(`[AsaasService] ✅ Assinatura ativa encontrada na API: ID=${activeSubscription.id}`);
    
    // Como encontramos uma assinatura ativa, vamos sincronizar o banco de dados
    await syncSubscriptionToDatabase(customerId, activeSubscription, true);
    
    // Checar pagamentos em aberto
    const paymentsResponse = await axios.get(
      `${ASAAS_API_URL}/payments?subscription=${activeSubscription.id}`,
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    );
    
    // Verificar se há pagamentos pendentes
    const pendingPayments = paymentsResponse.data && paymentsResponse.data.data ? 
      paymentsResponse.data.data.filter(payment => 
        payment.status === 'PENDING' || payment.status === 'RECEIVED' || payment.status === 'CONFIRMED'
      ) : [];
    
    return {
      success: true,
      message: 'Assinatura ativa encontrada',
      status: activeSubscription.status,
      hasActiveSubscription: true,
      subscription: activeSubscription,
      pendingPayments: pendingPayments.length > 0 ? pendingPayments : null
    };
    
  } catch (error) {
    console.error('[AsaasService] Erro ao verificar assinatura:', error);
    return {
      success: false,
      message: 'Erro ao verificar assinatura',
      status: 'ERROR',
      hasActiveSubscription: false,
      error: error.message
    };
  } finally {
    // Garantir que a conexão seja fechada em caso de erro
    if (client) {
      await client.close();
    }
  }
}

/**
 * Sincroniza dados de assinatura da API Asaas com o banco de dados local
 * @param {string} customerId - ID do cliente no Asaas
 * @param {Object} subscription - Dados da assinatura da API Asaas
 * @param {boolean} isActive - Se a assinatura está ativa
 */
async function syncSubscriptionToDatabase(customerId, subscription, isActive) {
  let client;
  
  try {
    console.log(`[AsaasService] Sincronizando assinatura de cliente ${customerId} com banco de dados`);
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DB_NAME);
    const status = isActive ? 'active' : mapAsaasStatusToLocal(subscription.status);
    
    // Buscar usuário pelo customerId
    const user = await db.collection('users').findOne({ 
      $or: [
        { customerId: customerId },
        { customer_id: customerId }
      ]
    });
    
    if (!user) {
      console.log(`[AsaasService] ⚠️ Usuário não encontrado para customer_id: ${customerId}`);
      return;
    }
    
    // 1. Atualizar ou criar registro na coleção 'subscriptions'
    const existingSubscription = await db.collection('subscriptions').findOne({ 
      customer_id: customerId,
      subscription_id: subscription.id
    });
    
    if (existingSubscription) {
      // Atualizar assinatura existente
      await db.collection('subscriptions').updateOne(
        { _id: existingSubscription._id },
        { 
          $set: { 
            status: status,
            original_asaas_status: subscription.status,
            updated_at: new Date()
          },
          $push: {
            status_history: {
              status: status,
              timestamp: new Date(),
              source: 'api_sync',
              original_status: subscription.status
            }
          }
        }
      );
    } else {
      // Criar nova assinatura
      await db.collection('subscriptions').insertOne({
        subscription_id: subscription.id,
        user_id: user._id.toString(),
        customer_id: customerId,
        plan_id: subscription.billingType || 'unknown',
        status: status,
        original_asaas_status: subscription.status,
        billing_type: subscription.billingType || 'unknown',
        value: subscription.value || 0,
        created_at: new Date(),
        status_history: [
          {
            status: status,
            timestamp: new Date(),
            source: 'api_sync',
            original_status: subscription.status
          }
        ]
      });
    }
    
    // 2. Atualizar ou criar registro na coleção 'userSubscriptions'
    const existingUserSubscription = await db.collection('userSubscriptions').findOne({ 
      asaasCustomerId: customerId
    });
    
    // Calcular próxima data de vencimento
    const nextDueDate = subscription.nextDueDate 
      ? new Date(subscription.nextDueDate) 
      : new Date(new Date().setDate(new Date().getDate() + 30));
    
    if (existingUserSubscription) {
      // Atualizar assinatura existente
      await db.collection('userSubscriptions').updateOne(
        { _id: existingUserSubscription._id },
        { 
          $set: { 
            status: status,
            asaasSubscriptionId: subscription.id,
            planType: subscription.billingType || existingUserSubscription.planType || 'basic',
            nextDueDate: nextDueDate,
            updatedAt: new Date()
          }
        }
      );
    } else {
      // Criar nova assinatura
      await db.collection('userSubscriptions').insertOne({
        userId: user._id.toString(),
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscription.id,
        status: status,
        planType: subscription.billingType || 'basic',
        nextDueDate: nextDueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    console.log(`[AsaasService] ✅ Assinatura sincronizada com banco de dados`);
    
  } catch (error) {
    console.error('[AsaasService] Erro ao sincronizar assinatura com banco de dados:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
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
    default:
      return asaasStatus.toLowerCase();
  }
}

/**
 * Cria ou recupera um cliente no Asaas
 * @param {Object} customerData - Dados do cliente
 * @param {string} customerData.name - Nome do cliente
 * @param {string} customerData.email - Email do cliente
 * @param {string} customerData.externalReference - Referência externa (ID do usuário)
 * @returns {Promise<Object>} - Objeto com informações do cliente
 */
async function createOrGetCustomer(customerData) {
  try {
    console.log(`[AsaasService] Buscando cliente por email: ${customerData.email}`);
    
    // Verificar se a chave da API está configurada
    if (!ASAAS_API_KEY) {
      console.error('[AsaasService] ❌ ASAAS_API_KEY não configurada');
      return {
        success: false,
        message: 'Chave da API Asaas não configurada',
        error: 'CONFIGURATION_ERROR'
      };
    }
    
    // Verificar se o cliente já existe pelo email
    const existingCustomerResponse = await axios.get(
      `${ASAAS_API_URL}/customers?email=${encodeURIComponent(customerData.email)}`,
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    );
    
    // Se encontrar cliente existente, retornar
    if (existingCustomerResponse.data && 
        existingCustomerResponse.data.data && 
        existingCustomerResponse.data.data.length > 0) {
      const customer = existingCustomerResponse.data.data[0];
      console.log(`[AsaasService] Cliente existente encontrado: ID=${customer.id}`);
      return {
        success: true,
        message: 'Cliente existente recuperado',
        customerId: customer.id,
        customer
      };
    }
    
    // Se não encontrar, criar novo cliente
    console.log(`[AsaasService] Criando novo cliente: ${customerData.name}`);
    const newCustomerResponse = await axios.post(
      `${ASAAS_API_URL}/customers`,
      {
        name: customerData.name,
        email: customerData.email,
        externalReference: customerData.externalReference,
        notificationDisabled: false
      },
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    );
    
    console.log(`[AsaasService] Novo cliente criado: ID=${newCustomerResponse.data.id}`);
    return {
      success: true,
      message: 'Novo cliente criado',
      customerId: newCustomerResponse.data.id,
      customer: newCustomerResponse.data
    };
    
  } catch (error) {
    console.error('[AsaasService] Erro ao criar/obter cliente:', error);
    return {
      success: false,
      message: 'Erro ao criar/obter cliente',
      error: error.message
    };
  }
}

module.exports = {
  checkSubscriptionStatus,
  createOrGetCustomer
}; 