/**
 * Cliente para comunicação com a API da Asaas
 */
const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

// Configuração base para o cliente axios
const createAsaasClient = () => {
  const baseURL = config.asaas.sandbox 
    ? 'https://sandbox.asaas.com/api/v3' 
    : config.asaas.apiUrl;

  const client = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      'access_token': config.asaas.apiKey
    },
    timeout: 10000 // 10 segundos
  });

  // Interceptor para logging
  client.interceptors.request.use(request => {
    const sanitizedRequest = { ...request };
    
    // Remove o token das logs para segurança
    if (sanitizedRequest.headers) {
      sanitizedRequest.headers = { ...sanitizedRequest.headers };
      if (sanitizedRequest.headers['access_token']) {
        sanitizedRequest.headers['access_token'] = '[REDACTED]';
      }
    }
    
    logger.debug(`Requisição para Asaas: ${request.method} ${request.url}`, {
      method: request.method,
      url: request.url,
      baseURL: sanitizedRequest.baseURL
    });
    
    return request;
  });

  // Interceptor para respostas
  client.interceptors.response.use(
    response => {
      logger.debug(`Resposta da Asaas: ${response.status}`, {
        status: response.status,
        url: response.config.url,
        method: response.config.method
      });
      return response;
    },
    error => {
      if (error.response) {
        logger.error(`Erro na resposta da Asaas: ${error.response.status}`, {
          status: error.response.status,
          url: error.config?.url,
          method: error.config?.method,
          data: error.response.data
        });
      } else if (error.request) {
        logger.error('Sem resposta da Asaas', {
          url: error.config?.url,
          method: error.config?.method,
          error: error.message
        });
      } else {
        logger.error('Erro na requisição para Asaas', {
          error: error.message
        });
      }
      return Promise.reject(error);
    }
  );

  return client;
};

// Cliente HTTP para a API da Asaas
const asaasClient = createAsaasClient();

/**
 * Obtém informações de uma assinatura
 * 
 * @param {string} subscriptionId - ID da assinatura
 * @returns {Promise<object>} Dados da assinatura
 */
async function getSubscription(subscriptionId) {
  try {
    const response = await asaasClient.get(`/subscriptions/${subscriptionId}`);
    return response.data;
  } catch (error) {
    logger.error(`Erro ao obter assinatura ${subscriptionId}`, {
      error: error.message,
      status: error.response?.status
    });
    throw new Error(`Erro ao obter assinatura: ${error.message}`);
  }
}

/**
 * Obtém a lista de pagamentos de uma assinatura
 * 
 * @param {string} subscriptionId - ID da assinatura
 * @param {object} options - Opções adicionais (offset, limit)
 * @returns {Promise<object>} Lista de pagamentos
 */
async function getSubscriptionPayments(subscriptionId, options = {}) {
  try {
    const params = {
      subscription: subscriptionId,
      offset: options.offset || 0,
      limit: options.limit || 100
    };
    
    const response = await asaasClient.get('/payments', { params });
    return response.data;
  } catch (error) {
    logger.error(`Erro ao obter pagamentos da assinatura ${subscriptionId}`, {
      error: error.message,
      status: error.response?.status
    });
    throw new Error(`Erro ao obter pagamentos: ${error.message}`);
  }
}

/**
 * Obtém informações de um cliente
 * 
 * @param {string} customerId - ID do cliente
 * @returns {Promise<object>} Dados do cliente
 */
async function getCustomer(customerId) {
  try {
    const response = await asaasClient.get(`/customers/${customerId}`);
    return response.data;
  } catch (error) {
    logger.error(`Erro ao obter cliente ${customerId}`, {
      error: error.message,
      status: error.response?.status
    });
    throw new Error(`Erro ao obter cliente: ${error.message}`);
  }
}

/**
 * Obtém informações de um pagamento
 * 
 * @param {string} paymentId - ID do pagamento
 * @returns {Promise<object>} Dados do pagamento
 */
async function getPayment(paymentId) {
  try {
    const response = await asaasClient.get(`/payments/${paymentId}`);
    return response.data;
  } catch (error) {
    logger.error(`Erro ao obter pagamento ${paymentId}`, {
      error: error.message,
      status: error.response?.status
    });
    throw new Error(`Erro ao obter pagamento: ${error.message}`);
  }
}

/**
 * Sincroniza dados de uma assinatura com a API da Asaas
 * 
 * @param {string} subscriptionId - ID da assinatura
 * @returns {Promise<object>} Dados atualizados
 */
async function syncSubscription(subscriptionId) {
  try {
    logger.info(`Sincronizando assinatura ${subscriptionId} com a API Asaas`);
    
    // Obtém dados da assinatura
    const subscription = await getSubscription(subscriptionId);
    
    // Obtém dados do cliente
    const customer = await getCustomer(subscription.customer);
    
    // Obtém pagamentos da assinatura
    const paymentsResponse = await getSubscriptionPayments(subscriptionId);
    const payments = paymentsResponse.data;
    
    return {
      subscription,
      customer,
      payments
    };
  } catch (error) {
    logger.errorWithStack(`Erro ao sincronizar assinatura ${subscriptionId}`, error);
    throw error;
  }
}

/**
 * Verifica o status de uma assinatura
 * 
 * @param {string} subscriptionId - ID da assinatura
 * @returns {Promise<object>} Status da assinatura
 */
async function checkSubscriptionStatus(subscriptionId) {
  try {
    const subscription = await getSubscription(subscriptionId);
    
    const isActive = config.asaas.validSubscriptionStatuses.includes(subscription.status);
    
    return {
      id: subscription.id,
      status: subscription.status,
      active: isActive,
      customer: subscription.customer,
      value: subscription.value,
      nextDueDate: subscription.nextDueDate,
      cycle: subscription.cycle,
      description: subscription.description
    };
  } catch (error) {
    logger.error(`Erro ao verificar status da assinatura ${subscriptionId}`, {
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  getSubscription,
  getSubscriptionPayments,
  getCustomer,
  getPayment,
  syncSubscription,
  checkSubscriptionStatus
};