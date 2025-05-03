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

// Variável para controlar verificação forçada no Asaas
// Pode ser usado para debugging ou em ambiente de produção em casos específicos
const FORCE_ASAAS_CHECK = process.env.FORCE_ASAAS_CHECK === 'true';

/**
 * Verifica o status de uma assinatura pelo ID do cliente, primeiro no MongoDB local
 * e depois, se necessário, na API do Asaas
 * @param {string} customerId - ID do cliente no Asaas
 * @param {string} userId - ID do usuário (opcional)
 * @returns {Promise<Object>} - Objeto com informações da assinatura
 */
async function checkSubscriptionStatus(customerId, userId = null) {
  // Primeiramente, verificar no banco de dados local se existe uma assinatura ativa
  try {
    console.log(`[AsaasService] Verificando assinatura para cliente: ${customerId}${userId ? `, usuário: ${userId}` : ''}`);
    
    // Verificar no banco de dados local primeiro
    if (!FORCE_ASAAS_CHECK) {
      console.log(`[AsaasService] Verificando primeiro no banco de dados local...`);
      const localStatus = await checkLocalSubscriptionStatus(customerId, userId);
      
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
 * @param {string} userId - ID do usuário (opcional)
 * @returns {Promise<Object>} - Objeto com informações da assinatura local
 */
async function checkLocalSubscriptionStatus(customerId, userId = null) {
  let client;

  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(MONGODB_DB_NAME);
    
    // Verificar na coleção 'subscriptions' pelo customerId
    console.log(`[AsaasService] Verificando na coleção 'subscriptions' pelo customer_id: ${customerId}`);
    const subscription = await db.collection('subscriptions').findOne({ customer_id: customerId });
    
    if (subscription && subscription.status === 'active') {
      console.log(`[AsaasService] Assinatura ativa encontrada na coleção 'subscriptions'`);
      return {
        success: true,
        message: 'Assinatura ativa encontrada no banco local',
        status: subscription.status,
        hasActiveSubscription: true,
        source: 'local_db_subscriptions',
        customerId: customerId
      };
    }
    
    // Verificar na coleção 'userSubscriptions' pelo asaasCustomerId
    console.log(`[AsaasService] Verificando na coleção 'userSubscriptions' pelo asaasCustomerId: ${customerId}`);
    const userSubscription = await db.collection('userSubscriptions').findOne({ asaasCustomerId: customerId });
    
    if (userSubscription && userSubscription.status === 'active') {
      console.log(`[AsaasService] Assinatura ativa encontrada na coleção 'userSubscriptions' pelo asaasCustomerId`);
      return {
        success: true,
        message: 'Assinatura ativa encontrada no banco local',
        status: userSubscription.status,
        hasActiveSubscription: true,
        source: 'local_db_userSubscriptions',
        customerId: customerId,
        userId: userSubscription.userId
      };
    }
    
    // Se temos um userId, verificar também pelo userId
    if (userId) {
      console.log(`[AsaasService] Verificando na coleção 'userSubscriptions' pelo userId: ${userId}`);
      const userSubByUserId = await db.collection('userSubscriptions').findOne({ 
        userId: userId,
        status: 'active'
      });
      
      if (userSubByUserId) {
        console.log(`[AsaasService] Assinatura ativa encontrada na coleção 'userSubscriptions' pelo userId`);
        return {
          success: true,
          message: 'Assinatura ativa encontrada no banco local pelo userId',
          status: userSubByUserId.status,
          hasActiveSubscription: true,
          source: 'local_db_userSubscriptions_userId',
          userId: userId,
          customerId: userSubByUserId.asaasCustomerId || customerId
        };
      }
      
      // Tentar buscar pelo _id do usuário se for uma string
      try {
        if (userId && userId.length === 24) {
          console.log(`[AsaasService] Tentando verificar com userId como ObjectId...`);
          const { ObjectId } = require('mongodb');
          const userIdObj = new ObjectId(userId);
          
          const userSubByObjectId = await db.collection('userSubscriptions').findOne({ 
            userId: userIdObj.toString(),
            status: 'active'
          });
          
          if (userSubByObjectId) {
            console.log(`[AsaasService] Assinatura ativa encontrada com userId como ObjectId`);
            return {
              success: true,
              message: 'Assinatura ativa encontrada no banco local pelo userId (ObjectId)',
              status: userSubByObjectId.status,
              hasActiveSubscription: true,
              source: 'local_db_userSubscriptions_objectId',
              userId: userId,
              customerId: userSubByObjectId.asaasCustomerId || customerId
            };
          }
        }
      } catch (err) {
        console.log(`[AsaasService] Erro ao tentar ObjectId: ${err.message}`);
      }
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

module.exports = {
  checkSubscriptionStatus,
  createOrGetCustomer
}; 