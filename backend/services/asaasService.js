/**
 * Serviço para interação com a API do Asaas
 * Implementa funções para verificação de assinaturas e outros recursos
 */

const axios = require('axios');

// Configuração do Asaas API
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

/**
 * Verifica o status de uma assinatura pelo ID do cliente
 * @param {string} customerId - ID do cliente no Asaas
 * @returns {Promise<Object>} - Objeto com informações da assinatura
 */
async function checkSubscriptionStatus(customerId) {
  try {
    console.log(`[AsaasService] Verificando assinatura para cliente: ${customerId}`);
    
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
 * Cria um checkout para assinatura no Asaas
 * @param {Object} subscriptionData - Dados da assinatura
 * @returns {Promise<Object>} - Informações do checkout
 */
async function createSubscriptionCheckout(subscriptionData) {
  try {
    console.log(`[AsaasService] Criando assinatura para cliente: ${subscriptionData.customer}`);
    
    // Criar assinatura no Asaas
    const subscriptionResponse = await axios.post(
      `${ASAAS_API_URL}/subscriptions`,
      {
        customer: subscriptionData.customer,
        billingType: subscriptionData.billingType,
        value: subscriptionData.value,
        nextDueDate: subscriptionData.nextDueDate,
        description: subscriptionData.description,
        cycle: subscriptionData.billingType === 'MONTHLY' ? 'MONTHLY' : 
              (subscriptionData.billingType === 'QUARTERLY' ? 'QUARTERLY' : 'YEARLY'),
        externalReference: subscriptionData.externalReference,
        autoRenew: subscriptionData.autoRenew === undefined ? true : subscriptionData.autoRenew,
      },
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    );
    
    console.log(`[AsaasService] Assinatura criada: ID=${subscriptionResponse.data.id}`);
    
    // Obter URL de checkout para a assinatura
    const checkoutResponse = await axios.post(
      `${ASAAS_API_URL}/subscriptions/${subscriptionResponse.data.id}/paymentLink`,
      {
        name: `Assinatura ${subscriptionData.description}`,
        description: subscriptionData.description,
        notificationEnabled: true
      },
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    );
    
    if (checkoutResponse.data && checkoutResponse.data.url) {
      console.log(`[AsaasService] URL de checkout gerada: ${checkoutResponse.data.url}`);
      
      return {
        success: true,
        message: 'Checkout criado com sucesso',
        subscriptionId: subscriptionResponse.data.id,
        checkoutUrl: checkoutResponse.data.url
      };
    } else {
      console.error('[AsaasService] Falha ao gerar URL de checkout');
      return {
        success: false,
        message: 'Falha ao gerar URL de checkout',
        error: 'CHECKOUT_URL_GENERATION_FAILED'
      };
    }
  } catch (error) {
    console.error('[AsaasService] Erro ao criar checkout de assinatura:', error);
    return {
      success: false,
      message: 'Erro ao criar checkout de assinatura',
      error: error.message
    };
  }
}

module.exports = {
  checkSubscriptionStatus,
  createOrGetCustomer,
  createSubscriptionCheckout
}; 