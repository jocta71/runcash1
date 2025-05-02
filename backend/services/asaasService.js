/**
 * Serviço para interação com a API do Asaas
 * Implementa funções para verificação de assinaturas e outros recursos
 */

const axios = require('axios');

// Configurações do Asaas - devem vir de variáveis de ambiente
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || 'seu_api_key_asaas';
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';

// Configurar cliente axios com autenticação
const asaasClient = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY
  }
});

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
 * Cria um cliente no Asaas
 */
const createCustomer = async (customerData) => {
  try {
    const response = await asaasClient.post('/customers', {
      name: customerData.name,
      email: customerData.email,
      mobilePhone: customerData.phone || null,
      cpfCnpj: customerData.cpfCnpj || null,
      externalReference: customerData.externalId || null,
      notificationDisabled: false
    });
    
    return response.data;
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error.response?.data || error.message);
    throw new Error('Falha ao criar cliente no Asaas');
  }
};

/**
 * Cria uma assinatura no Asaas
 */
const createSubscription = async (subscriptionData) => {
  try {
    const payload = {
      customer: subscriptionData.customer,
      billingType: subscriptionData.billingType || 'CREDIT_CARD',
      value: subscriptionData.value,
      nextDueDate: formatDate(subscriptionData.nextDueDate),
      cycle: subscriptionData.cycle || 'MONTHLY',
      description: subscriptionData.description || 'Assinatura RunCash',
      externalReference: subscriptionData.externalReference || null,
      creditCardHolderInfo: subscriptionData.creditCardHolderInfo || null,
      creditCard: subscriptionData.creditCard || null,
      creditCardToken: subscriptionData.creditCardToken || null
    };
    
    const response = await asaasClient.post('/subscriptions', payload);
    return response.data;
  } catch (error) {
    console.error('Erro ao criar assinatura no Asaas:', error.response?.data || error.message);
    throw new Error('Falha ao criar assinatura no Asaas');
  }
};

/**
 * Gera URL de checkout para pagamento da assinatura
 */
const generateCheckoutUrl = async (checkoutData) => {
  try {
    // Primeiro, consulta a assinatura para ter certeza que existe
    const subscription = await getSubscription(checkoutData.subscription);
    
    // Criar URL de checkout
    const response = await asaasClient.post('/paymentLinks', {
      name: subscription.description || 'Assinatura RunCash',
      description: `Assinatura ${subscription.cycle.toLowerCase()} - RunCash`,
      billingType: subscription.billingType,
      value: subscription.value,
      subscriptionCycle: subscription.cycle,
      maxInstallmentCount: 1,
      dueDateLimitDays: 3,
      notificationEnabled: true,
      externalReference: subscription.id,
      callback: {
        successUrl: checkoutData.returnUrl,
        autoRedirect: true
      },
      creditCard: {
        enabled: true,
        automaticCapture: true
      },
      boleto: subscription.billingType === 'BOLETO' ? {
        enabled: true,
        expirationDate: subscription.nextDueDate
      } : { enabled: false },
      pix: {
        enabled: true,
        expirationDate: formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000)) // 1 dia
      }
    });

    return response.data.url;
  } catch (error) {
    console.error('Erro ao gerar URL de checkout:', error.response?.data || error.message);
    throw new Error('Falha ao gerar URL de checkout');
  }
};

/**
 * Consulta uma assinatura existente
 */
const getSubscription = async (subscriptionId) => {
  try {
    const response = await asaasClient.get(`/subscriptions/${subscriptionId}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao consultar assinatura:', error.response?.data || error.message);
    throw new Error('Falha ao consultar assinatura');
  }
};

/**
 * Cancela uma assinatura existente
 */
const cancelSubscription = async (subscriptionId) => {
  try {
    const response = await asaasClient.delete(`/subscriptions/${subscriptionId}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error.response?.data || error.message);
    throw new Error('Falha ao cancelar assinatura');
  }
};

/**
 * Formata uma data para o padrão do Asaas (YYYY-MM-DD)
 */
const formatDate = (date) => {
  if (!date) return null;
  
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

module.exports = {
  checkSubscriptionStatus,
  createOrGetCustomer,
  createCustomer,
  createSubscription,
  getSubscription,
  cancelSubscription,
  generateCheckoutUrl
}; 