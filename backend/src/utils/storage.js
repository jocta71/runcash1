/**
 * Utilitário para armazenamento dos dados recebidos via webhook
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('./logger');

// Diretório para armazenar os dados persistentes
const DATA_DIR = path.resolve(process.cwd(), 'data');

// Garante que o diretório existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  logger.info(`Diretório de dados criado: ${DATA_DIR}`);
}

// Armazenamento em memória
const storage = {
  webhookEvents: [],
  subscriptions: {},
  payments: {},
  customers: {}
};

// Caminhos para os arquivos de armazenamento
const dataFiles = {
  subscriptions: path.join(DATA_DIR, 'subscriptions.json'),
  payments: path.join(DATA_DIR, 'payments.json'),
  customers: path.join(DATA_DIR, 'customers.json')
};

/**
 * Carrega dados persistidos do disco para a memória
 */
function loadPersistedData() {
  try {
    // Carrega assinaturas
    if (fs.existsSync(dataFiles.subscriptions)) {
      const data = fs.readFileSync(dataFiles.subscriptions, 'utf8');
      storage.subscriptions = JSON.parse(data);
      logger.info(`Assinaturas carregadas: ${Object.keys(storage.subscriptions).length}`);
    }

    // Carrega pagamentos
    if (fs.existsSync(dataFiles.payments)) {
      const data = fs.readFileSync(dataFiles.payments, 'utf8');
      storage.payments = JSON.parse(data);
      logger.info(`Pagamentos carregados: ${Object.keys(storage.payments).length}`);
    }

    // Carrega clientes
    if (fs.existsSync(dataFiles.customers)) {
      const data = fs.readFileSync(dataFiles.customers, 'utf8');
      storage.customers = JSON.parse(data);
      logger.info(`Clientes carregados: ${Object.keys(storage.customers).length}`);
    }
  } catch (error) {
    logger.errorWithStack('Erro ao carregar dados do disco', error);
  }
}

/**
 * Salva dados da memória para o disco
 * @param {string} dataType - Tipo de dados a serem salvos (subscriptions, payments, customers)
 */
function persistData(dataType) {
  if (!dataFiles[dataType]) {
    logger.warn(`Tipo de dados desconhecido: ${dataType}`);
    return;
  }

  try {
    const data = JSON.stringify(storage[dataType], null, 2);
    fs.writeFileSync(dataFiles[dataType], data, 'utf8');
    logger.debug(`Dados persistidos: ${dataType}, ${Object.keys(storage[dataType]).length} itens`);
  } catch (error) {
    logger.errorWithStack(`Erro ao persistir dados: ${dataType}`, error);
  }
}

/**
 * Função para limpar eventos antigos
 */
function cleanupOldEvents() {
  const now = Date.now();
  const cutoffTime = now - config.server.eventExpiryTime;
  
  const initialCount = storage.webhookEvents.length;
  storage.webhookEvents = storage.webhookEvents.filter(event => 
    event.receivedAt && event.receivedAt > cutoffTime
  );
  
  if (initialCount !== storage.webhookEvents.length) {
    logger.debug(`Limpeza de eventos: ${initialCount - storage.webhookEvents.length} removidos, ${storage.webhookEvents.length} mantidos`);
  }
}

/**
 * Função para registrar um evento recebido
 * @param {object} event - Evento a ser registrado
 * @returns {object} Evento com timestamp de recebimento adicionado
 */
function recordWebhookEvent(event) {
  const eventWithTimestamp = {
    ...event,
    receivedAt: Date.now()
  };
  
  // Adiciona ao início do array para ter os mais recentes primeiro
  storage.webhookEvents.unshift(eventWithTimestamp);
  
  // Limita o tamanho máximo
  if (storage.webhookEvents.length > config.server.maxStoredEvents) {
    storage.webhookEvents.pop();
  }
  
  logger.debug('Evento registrado', { eventId: event.id, eventType: event.event });
  return eventWithTimestamp;
}

/**
 * Atualiza ou cria uma assinatura no cache
 * @param {object} subscription - Dados da assinatura
 * @returns {object} Assinatura atualizada
 */
function updateSubscriptionCache(subscription) {
  if (!subscription || !subscription.id) {
    logger.warn('Tentativa de atualizar assinatura sem ID válido');
    return null;
  }
  
  // Obtém a assinatura atual ou cria uma nova
  const currentSubscription = storage.subscriptions[subscription.id] || {};
  
  // Atualiza com novos dados e adiciona timestamp
  storage.subscriptions[subscription.id] = {
    ...currentSubscription,
    ...subscription,
    updatedAt: Date.now()
  };
  
  logger.info(`Assinatura atualizada: ${subscription.id}`, { 
    status: subscription.status, 
    customerId: subscription.customer 
  });
  
  // Atualiza o cliente se a assinatura tiver essa informação
  if (subscription.customer) {
    updateCustomerCache({
      id: subscription.customer,
      hasSubscription: true,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status
    });
  }
  
  // Persiste os dados atualizados
  persistData('subscriptions');
  
  return storage.subscriptions[subscription.id];
}

/**
 * Atualiza ou cria um pagamento no cache
 * @param {object} payment - Dados do pagamento
 * @returns {object} Pagamento atualizado
 */
function updatePaymentCache(payment) {
  if (!payment || !payment.id) {
    logger.warn('Tentativa de atualizar pagamento sem ID válido');
    return null;
  }
  
  // Obtém o pagamento atual ou cria um novo
  const currentPayment = storage.payments[payment.id] || {};
  
  // Atualiza com novos dados e adiciona timestamp
  storage.payments[payment.id] = {
    ...currentPayment,
    ...payment,
    updatedAt: Date.now()
  };
  
  logger.info(`Pagamento atualizado: ${payment.id}`, { 
    status: payment.status, 
    value: payment.value,
    dueDate: payment.dueDate
  });
  
  // Atualiza o cliente se o pagamento tiver essa informação
  if (payment.customer) {
    updateCustomerCache({
      id: payment.customer,
      lastPayment: {
        id: payment.id,
        status: payment.status,
        value: payment.value,
        dueDate: payment.dueDate
      }
    });
  }
  
  // Persiste os dados atualizados
  persistData('payments');
  
  return storage.payments[payment.id];
}

/**
 * Atualiza ou cria um cliente no cache
 * @param {object} customer - Dados do cliente
 * @returns {object} Cliente atualizado
 */
function updateCustomerCache(customer) {
  if (!customer || !customer.id) {
    logger.warn('Tentativa de atualizar cliente sem ID válido');
    return null;
  }
  
  // Obtém o cliente atual ou cria um novo
  const currentCustomer = storage.customers[customer.id] || {
    subscriptions: [],
    payments: []
  };
  
  // Atualiza com novos dados e adiciona timestamp
  storage.customers[customer.id] = {
    ...currentCustomer,
    ...customer,
    updatedAt: Date.now()
  };
  
  // Se houver informação de assinatura, adiciona ao array de assinaturas
  if (customer.subscriptionId && !currentCustomer.subscriptions.includes(customer.subscriptionId)) {
    storage.customers[customer.id].subscriptions.push(customer.subscriptionId);
  }
  
  // Se houver informação de pagamento, adiciona ao array de pagamentos
  if (customer.lastPayment && customer.lastPayment.id && 
      !currentCustomer.payments.includes(customer.lastPayment.id)) {
    storage.customers[customer.id].payments.push(customer.lastPayment.id);
  }
  
  logger.debug(`Cliente atualizado: ${customer.id}`);
  
  // Persiste os dados atualizados
  persistData('customers');
  
  return storage.customers[customer.id];
}

/**
 * Obtém os clientes com assinaturas ativas
 * @returns {Array} Lista de clientes com assinaturas ativas
 */
function getActiveCustomers() {
  return Object.values(storage.customers).filter(customer => {
    // Verifica se o cliente tem status de assinatura ativa
    if (customer.subscriptionStatus && 
        config.asaas.validSubscriptionStatuses.includes(customer.subscriptionStatus)) {
      return true;
    }
    
    // Verifica se alguma das assinaturas do cliente está ativa
    if (customer.subscriptions && customer.subscriptions.length > 0) {
      return customer.subscriptions.some(subId => {
        const sub = storage.subscriptions[subId];
        return sub && config.asaas.validSubscriptionStatuses.includes(sub.status);
      });
    }
    
    return false;
  });
}

/**
 * Verifica se um cliente tem assinatura ativa
 * @param {string} customerId - ID do cliente
 * @returns {boolean} Verdadeiro se o cliente tem assinatura ativa
 */
function customerHasActiveSubscription(customerId) {
  if (!customerId) return false;
  
  const customer = storage.customers[customerId];
  if (!customer) return false;
  
  // Verifica o status direto no cliente
  if (customer.subscriptionStatus && 
      config.asaas.validSubscriptionStatuses.includes(customer.subscriptionStatus)) {
    return true;
  }
  
  // Verifica nas assinaturas do cliente
  if (customer.subscriptions && customer.subscriptions.length > 0) {
    return customer.subscriptions.some(subId => {
      const sub = storage.subscriptions[subId];
      return sub && config.asaas.validSubscriptionStatuses.includes(sub.status);
    });
  }
  
  return false;
}

// Inicia a limpeza periódica de eventos
setInterval(cleanupOldEvents, config.server.cleanupInterval);

// Carrega dados persistidos ao iniciar
loadPersistedData();

// Exporta as funções e o storage
module.exports = {
  storage,
  recordWebhookEvent,
  updateSubscriptionCache,
  updatePaymentCache,
  updateCustomerCache,
  getActiveCustomers,
  customerHasActiveSubscription,
  persistData
}; 