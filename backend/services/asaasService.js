/**
 * Serviço para interação com a API do Asaas
 * Implementa funções para verificação de assinaturas e outros recursos
 */

const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Configuração do Asaas API
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Variável para controlar verificação forçada no Asaas
// Pode ser usado para debugging ou em ambiente de produção em casos específicos
const FORCE_ASAAS_CHECK = process.env.FORCE_ASAAS_CHECK === 'true';

// Flag para habilitar atualização automática do banco local ao consultar na API
const AUTO_SYNC_ON_CHECK = process.env.AUTO_SYNC_ON_CHECK !== 'false';

/**
 * Verifica o status de uma assinatura pelo ID do cliente, primeiro no MongoDB local
 * e depois, se necessário, na API do Asaas
 * @param {string} customerId - ID do cliente no Asaas
 * @returns {Promise<Object>} - Objeto com informações da assinatura
 */
async function checkSubscriptionStatus(customerId) {
  // Primeiramente, verificar no banco de dados local se existe uma assinatura ativa
  try {
    console.log(`[AsaasService] Verificando assinatura para cliente: ${customerId}`);
    
    // Verificar no banco de dados local primeiro
    if (!FORCE_ASAAS_CHECK) {
      console.log(`[AsaasService] Verificando primeiro no banco de dados local...`);
      const localStatus = await checkLocalSubscriptionStatus(customerId);
      
      if (localStatus.hasActiveSubscription) {
        console.log(`[AsaasService] Assinatura ativa encontrada no banco de dados local`);
        return localStatus;
      }
      
      console.log(`[AsaasService] Nenhuma assinatura ativa encontrada no banco local, verificando na API Asaas...`);
    }
    
    // Se não encontrar no banco local ou se FORCE_ASAAS_CHECK for true, verificar na API do Asaas
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
      
      // Se AUTO_SYNC_ON_CHECK estiver habilitado, atualizar o banco local
      if (AUTO_SYNC_ON_CHECK) {
        await syncSubscriptionToDatabase(latestSubscription, customerId);
      }
      
      return {
        success: true,
        message: 'Nenhuma assinatura ativa encontrada',
        status: latestSubscription.status,
        hasActiveSubscription: false,
        subscription: latestSubscription
      };
    }
    
    console.log(`[AsaasService] Assinatura ativa encontrada: ID=${activeSubscription.id}`);
    
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
      
    // Se AUTO_SYNC_ON_CHECK estiver habilitado, atualizar o banco local
    if (AUTO_SYNC_ON_CHECK) {
      await syncSubscriptionToDatabase(activeSubscription, customerId);
    }
    
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
  }
}

/**
 * Verifica o status da assinatura diretamente no banco de dados local
 * @param {string} customerId - ID do cliente no Asaas
 * @returns {Promise<Object>} - Objeto com informações da assinatura local
 */
async function checkLocalSubscriptionStatus(customerId) {
  let client;

  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DB_NAME);
    
    // Verificar na coleção 'subscriptions'
    console.log(`[AsaasService] Verificando na coleção 'subscriptions'...`);
    const subscription = await db.collection('subscriptions').findOne({ customer_id: customerId });
    
    if (subscription && subscription.status === 'active') {
      console.log(`[AsaasService] Assinatura ativa encontrada na coleção 'subscriptions'`);
      return {
        success: true,
        message: 'Assinatura ativa encontrada no banco local',
        status: subscription.status,
        hasActiveSubscription: true,
        source: 'local_db_subscriptions'
      };
    }
    
    // Verificar na coleção 'userSubscriptions'
    console.log(`[AsaasService] Verificando na coleção 'userSubscriptions'...`);
    const userSubscription = await db.collection('userSubscriptions').findOne({ asaasCustomerId: customerId });
    
    if (userSubscription && userSubscription.status === 'active') {
      console.log(`[AsaasService] Assinatura ativa encontrada na coleção 'userSubscriptions'`);
      return {
        success: true,
        message: 'Assinatura ativa encontrada no banco local',
        status: userSubscription.status,
        hasActiveSubscription: true,
        source: 'local_db_userSubscriptions'
      };
    }
    
    // Nenhuma assinatura ativa encontrada
    console.log(`[AsaasService] Nenhuma assinatura ativa encontrada no banco local`);
    return {
      success: false,
      message: 'Nenhuma assinatura ativa encontrada no banco local',
      status: 'INACTIVE',
      hasActiveSubscription: false,
      source: 'local_db'
    };
    
  } catch (error) {
    console.error('[AsaasService] Erro ao verificar assinatura no banco local:', error);
    return {
      success: false,
      message: 'Erro ao verificar assinatura no banco local',
      status: 'ERROR',
      hasActiveSubscription: false,
      error: error.message
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
}

/**
 * Sincroniza dados de uma assinatura do Asaas para o banco de dados local
 * @param {Object} subscription - Dados da assinatura vinda do Asaas
 * @param {string} customerId - ID do cliente no Asaas
 * @returns {Promise<boolean>} - Retorna true se a sincronização foi bem-sucedida
 */
async function syncSubscriptionToDatabase(subscription, customerId) {
  let client;
  
  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DB_NAME);
    
    // Mapear status do Asaas para o formato usado no banco local
    const statusMap = {
      'ACTIVE': 'active',
      'INACTIVE': 'inactive',
      'OVERDUE': 'overdue',
      'PENDING': 'pending'
    };
    
    const localStatus = statusMap[subscription.status] || subscription.status.toLowerCase();
    
    // 1. Atualizar na coleção 'subscriptions'
    console.log(`[AsaasService] Sincronizando assinatura ${subscription.id} na coleção 'subscriptions'`);
    
    const existingSubscription = await db.collection('subscriptions').findOne({ 
      subscription_id: subscription.id
    });
    
    if (existingSubscription) {
      // Atualizar assinatura existente
      await db.collection('subscriptions').updateOne(
        { subscription_id: subscription.id },
        { 
          $set: {
            status: localStatus,
            last_update: new Date(),
            value: subscription.value,
            next_due_date: subscription.nextDueDate,
            cycle: subscription.cycle,
            description: subscription.description
          },
          $push: {
            status_history: {
              status: localStatus,
              timestamp: new Date(),
              source: 'asaas_api'
            }
          }
        }
      );
    } else {
      // Verificar se existe usuário associado ao customer_id
      const user = await db.collection('users').findOne({ customerId });
      
      if (!user) {
        console.log(`[AsaasService] Nenhum usuário encontrado com customerId ${customerId}, não é possível criar registro na coleção 'subscriptions'`);
        return false;
      }
      
      // Criar nova entrada na coleção 'subscriptions'
      await db.collection('subscriptions').insertOne({
        subscription_id: subscription.id,
        customer_id: customerId,
        user_id: user._id.toString(),
        status: localStatus,
        value: subscription.value,
        next_due_date: subscription.nextDueDate,
        cycle: subscription.cycle,
        description: subscription.description,
        created_at: new Date(),
        last_update: new Date(),
        status_history: [
          {
            status: localStatus,
            timestamp: new Date(),
            source: 'asaas_api'
          }
        ]
      });
    }
    
    // 2. Atualizar na coleção 'userSubscriptions'
    console.log(`[AsaasService] Sincronizando assinatura ${subscription.id} na coleção 'userSubscriptions'`);
    
    // Verificar se já existe registro em userSubscriptions
    const existingUserSubscription = await db.collection('userSubscriptions').findOne({
      asaasSubscriptionId: subscription.id
    });
    
    if (existingUserSubscription) {
      // Atualizar assinatura existente
      await db.collection('userSubscriptions').updateOne(
        { asaasSubscriptionId: subscription.id },
        {
          $set: {
            status: localStatus,
            nextDueDate: subscription.nextDueDate,
            updatedAt: new Date(),
            planValue: subscription.value
          },
          $push: {
            statusHistory: {
              status: localStatus,
              date: new Date(),
              source: 'asaas_api'
            }
          }
        }
      );
    } else {
      // Buscar informações do usuário
      const user = await db.collection('users').findOne({ customerId });
      
      if (!user) {
        console.log(`[AsaasService] Nenhum usuário encontrado com customerId ${customerId}, não é possível criar registro na coleção 'userSubscriptions'`);
        return false;
      }
      
      // Determinar o tipo de plano com base na descrição ou valor
      let planType = 'basic'; // padrão
      
      if (subscription.description) {
        const description = subscription.description.toLowerCase();
        if (description.includes('premium') || description.includes('pro')) {
          planType = 'premium';
        } else if (description.includes('vip') || description.includes('ultimate')) {
          planType = 'vip';
        }
      } else if (subscription.value) {
        // Lógica alternativa baseada no valor
        const value = parseFloat(subscription.value);
        if (value >= 100) {
          planType = 'vip';
        } else if (value >= 50) {
          planType = 'premium';
        }
      }
      
      // Criar nova entrada na coleção 'userSubscriptions'
      await db.collection('userSubscriptions').insertOne({
        userId: user._id.toString(),
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscription.id,
        planType,
        status: localStatus,
        nextDueDate: subscription.nextDueDate,
        planValue: subscription.value,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusHistory: [
          {
            status: localStatus,
            date: new Date(),
            source: 'asaas_api'
          }
        ]
      });
    }
    
    console.log(`[AsaasService] Sincronização concluída com sucesso para assinatura ${subscription.id}`);
    return true;
    
  } catch (error) {
    console.error('[AsaasService] Erro ao sincronizar assinatura com o banco de dados:', error);
    return false;
  } finally {
    if (client) {
      await client.close();
    }
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

/**
 * Atualiza o customerId de um usuário no banco de dados
 * @param {string} userId - ID do usuário
 * @param {string} customerId - ID do cliente no Asaas
 * @returns {Promise<boolean>} - Indica se a atualização foi bem-sucedida
 */
async function updateUserCustomerId(userId, customerId) {
  // ... existing code ...
}

module.exports = {
  checkSubscriptionStatus,
  checkLocalSubscriptionStatus,
  createOrGetCustomer,
  updateUserCustomerId,
  syncSubscriptionToDatabase
}; 