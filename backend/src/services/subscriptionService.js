// Serviço para gerenciamento de assinaturas
const axios = require('axios');
const { getFromCache, saveToCache, isExpired } = require('./cacheService');
const logger = require('../utils/logger');
const { Subscription, Payment, User } = require('../models');

// Dados de configuração
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

// Armazenamento em memória para assinaturas
const subscriptions = new Map();
const payments = new Map();
const userAccess = new Map();

/**
 * Verifica se uma assinatura tem pagamento confirmado
 * @param {string} subscriptionId - ID da assinatura
 * @returns {boolean} - true se tiver pagamento confirmado, false caso contrário
 */
async function checkSubscriptionPayment(subscriptionId) {
  try {
    // 1. Verificar cache primeiro
    const cacheKey = `subscription_payments_${subscriptionId}`;
    const cachedData = await getFromCache(cacheKey);
    
    if (cachedData && !isExpired(cachedData.updatedAt, 300)) {
      return cachedData.hasConfirmedPayment;
    }
    
    // 2. Buscar pagamentos da API
    const response = await axios.get(`${ASAAS_API_URL}/subscriptions/${subscriptionId}/payments`, {
      headers: { 'access_token': ASAAS_API_KEY }
    });
    
    // 3. Verificar status dos pagamentos
    const paymentsData = response.data.data || [];
    
    // Armazenar pagamentos em memória
    paymentsData.forEach(payment => {
      payments.set(payment.id, {
        id: payment.id,
        subscriptionId,
        status: payment.status,
        value: payment.value,
        dueDate: payment.dueDate,
        paymentDate: payment.paymentDate,
        updatedAt: new Date().toISOString()
      });
    });
    
    // 4. Verificar se há pagamento confirmado
    const hasConfirmedPayment = paymentsData.some(payment => 
      payment.status === 'CONFIRMED' || 
      payment.status === 'RECEIVED'
    );
    
    // 5. Salvar em cache
    await saveToCache(cacheKey, {
      hasConfirmedPayment,
      payments: paymentsData.slice(0, 5), // Armazenar apenas os 5 últimos
      lastPaymentStatus: paymentsData.length > 0 ? paymentsData[0].status : null,
      updatedAt: new Date().toISOString()
    }, 300); // 5 minutos
    
    return hasConfirmedPayment;
    
  } catch (error) {
    console.error(`[Assinatura] Erro ao verificar pagamentos da assinatura ${subscriptionId}:`, error);
    return false;
  }
}

/**
 * Busca assinatura de um cliente
 * @param {string} customerId - ID do cliente
 * @returns {Object|null} - Dados da assinatura ou null
 */
async function getCustomerSubscription(customerId) {
  try {
    // 1. Verificar cache primeiro
    const cacheKey = `customer_subscription_${customerId}`;
    const cachedData = await getFromCache(cacheKey);
    
    if (cachedData && !isExpired(cachedData.updatedAt, 300)) {
      return cachedData.subscription;
    }
    
    // 2. Buscar da API
    const response = await axios.get(`${ASAAS_API_URL}/subscriptions`, {
      params: { customer: customerId },
      headers: { 'access_token': ASAAS_API_KEY }
    });
    
    const subscriptionsData = response.data.data || [];
    
    // 3. Encontrar assinatura ativa ou mais recente
    const subscription = subscriptionsData.find(sub => sub.status === 'ACTIVE') || 
                        (subscriptionsData.length > 0 ? subscriptionsData[0] : null);
    
    if (subscription) {
      // Armazenar em memória
      subscriptions.set(subscription.id, {
        id: subscription.id,
        customerId,
        status: subscription.status,
        value: subscription.value,
        nextDueDate: subscription.nextDueDate,
        cycle: subscription.cycle,
        updatedAt: new Date().toISOString()
      });
      
      // Salvar em cache
      await saveToCache(cacheKey, {
        subscription,
        updatedAt: new Date().toISOString()
      }, 300); // 5 minutos
    }
    
    return subscription;
    
  } catch (error) {
    console.error(`[Assinatura] Erro ao buscar assinatura do cliente ${customerId}:`, error);
    return null;
  }
}

/**
 * Atualiza status de uma assinatura
 * @param {string} subscriptionId - ID da assinatura
 * @param {string} status - Novo status
 */
async function updateSubscriptionStatus(subscriptionId, status) {
  try {
    const subscription = subscriptions.get(subscriptionId);
    
    if (subscription) {
      subscription.status = status;
      subscription.updatedAt = new Date().toISOString();
      
      // Limpar cache
      const cacheKey = `customer_subscription_${subscription.customerId}`;
      await saveToCache(cacheKey, null, 0);
    }
    
    return true;
  } catch (error) {
    console.error(`[Assinatura] Erro ao atualizar status da assinatura ${subscriptionId}:`, error);
    return false;
  }
}

/**
 * Atualiza status de um pagamento
 * @param {Object} paymentData - Dados do pagamento
 */
async function updatePaymentStatus(paymentData) {
  try {
    const { paymentId, subscriptionId, status } = paymentData;
    
    // Atualizar em memória
    payments.set(paymentId, {
      ...paymentData,
      updatedAt: new Date().toISOString()
    });
    
    // Limpar cache
    const cacheKey = `subscription_payments_${subscriptionId}`;
    await saveToCache(cacheKey, null, 0);
    
    return true;
  } catch (error) {
    console.error(`[Assinatura] Erro ao atualizar status do pagamento ${paymentData.paymentId}:`, error);
    return false;
  }
}

/**
 * Atualiza acesso de um usuário
 * @param {string} customerId - ID do cliente
 * @param {boolean} hasAccess - Se tem acesso
 */
async function updateUserAccess(customerId, hasAccess) {
  try {
    userAccess.set(customerId, {
      hasAccess,
      updatedAt: new Date().toISOString()
    });
    
    // Emitir evento para notificar outros serviços
    console.log(`[Assinatura] Acesso do usuário ${customerId} ${hasAccess ? 'liberado' : 'revogado'}`);
    
    // Aqui você pode adicionar código para atualizar o banco de dados ou notificar outros sistemas
    
    return true;
  } catch (error) {
    console.error(`[Assinatura] Erro ao atualizar acesso do usuário ${customerId}:`, error);
    return false;
  }
}

/**
 * Verifica se um usuário tem acesso ativo
 * @param {string} customerId - ID do cliente
 * @returns {boolean} - true se tem acesso, false caso contrário
 */
async function hasActivePlan(customerId) {
  try {
    // 1. Verificar cache de acesso primeiro (mais rápido)
    const accessData = userAccess.get(customerId);
    if (accessData && !isExpired(accessData.updatedAt, 600)) { // 10 minutos
      return accessData.hasAccess;
    }
    
    // 2. Verificar status da assinatura
    const subscription = await getCustomerSubscription(customerId);
    
    if (!subscription || subscription.status !== 'ACTIVE') {
      // Atualizar acesso
      await updateUserAccess(customerId, false);
      return false;
    }
    
    // 3. CRUCIAL: Verificar se há pagamento confirmado
    const hasConfirmedPayment = await checkSubscriptionPayment(subscription.id);
    
    // 4. Atualizar acesso
    await updateUserAccess(customerId, hasConfirmedPayment);
    
    return hasConfirmedPayment;
    
  } catch (error) {
    console.error(`[Assinatura] Erro ao verificar plano ativo para ${customerId}:`, error);
    return false;
  }
}

/**
 * Recebe eventos de assinatura da Asaas (webhook)
 * @param {Object} event - Evento recebido
 */
async function processSubscriptionEvent(event) {
  try {
    switch (event.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        await handlePaymentConfirmed(event);
        break;
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(event);
        break;
      case 'SUBSCRIPTION_CREATED':
        await handleSubscriptionCreated(event);
        break;
      case 'SUBSCRIPTION_UPDATED':
        await handleSubscriptionUpdated(event);
        break;
      case 'SUBSCRIPTION_CANCELLED':
        await handleSubscriptionCancelled(event);
        break;
    }
    
    return true;
  } catch (error) {
    console.error(`[Assinatura] Erro ao processar evento ${event.event}:`, error);
    return false;
  }
}

// Funções internas para tratar eventos
async function handlePaymentConfirmed(event) {
  const payment = event.payment;
  const subscriptionId = payment.subscription;
  
  if (!subscriptionId) return;
  
  await updatePaymentStatus({
    paymentId: payment.id,
    subscriptionId,
    status: 'CONFIRMED',
    value: payment.value,
    paymentDate: payment.paymentDate
  });
  
  await updateUserAccess(payment.customer, true);
}

async function handlePaymentOverdue(event) {
  const payment = event.payment;
  const subscriptionId = payment.subscription;
  
  if (!subscriptionId) return;
  
  await updatePaymentStatus({
    paymentId: payment.id,
    subscriptionId,
    status: 'OVERDUE',
    value: payment.value,
    dueDate: payment.dueDate
  });
  
  // Configuração para revogar acesso em caso de atraso
  const revokeAccessOnOverdue = true; // Pode vir de configuração
  
  if (revokeAccessOnOverdue) {
    await updateUserAccess(payment.customer, false);
  }
}

async function handleSubscriptionCreated(event) {
  const subscription = event.subscription;
  
  subscriptions.set(subscription.id, {
    id: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
    value: subscription.value,
    nextDueDate: subscription.nextDueDate,
    cycle: subscription.cycle,
    updatedAt: new Date().toISOString()
  });
  
  // Nota: Não liberar acesso imediatamente, aguardar confirmação de pagamento
}

async function handleSubscriptionUpdated(event) {
  const subscription = event.subscription;
  
  subscriptions.set(subscription.id, {
    id: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
    value: subscription.value,
    nextDueDate: subscription.nextDueDate,
    cycle: subscription.cycle,
    updatedAt: new Date().toISOString()
  });
  
  // Verificar se há pagamento confirmado antes de liberar acesso
  const hasConfirmedPayment = await checkSubscriptionPayment(subscription.id);
  
  // Só liberar acesso se status for ACTIVE E tiver pagamento confirmado
  if (subscription.status === 'ACTIVE' && hasConfirmedPayment) {
    await updateUserAccess(subscription.customer, true);
  } else {
    await updateUserAccess(subscription.customer, false);
  }
}

async function handleSubscriptionCancelled(event) {
  const subscription = event.subscription;
  
  subscriptions.set(subscription.id, {
    id: subscription.id,
    customerId: subscription.customer,
    status: 'CANCELLED',
    updatedAt: new Date().toISOString()
  });
  
  // Revogar acesso
  await updateUserAccess(subscription.customer, false);
}

/**
 * Serviço para gerenciar assinaturas e pagamentos
 */
class SubscriptionService {
  /**
   * Atualiza ou cria uma assinatura com base nas informações recebidas do webhook
   * @param {string} subscriptionId - ID da assinatura
   * @param {string} customerId - ID do cliente na Asaas
   * @param {string} status - Status da assinatura
   * @param {number} value - Valor da assinatura
   * @param {string} nextDueDate - Próxima data de vencimento
   * @param {string} cycle - Ciclo de pagamento (MONTHLY, YEARLY, etc)
   * @returns {Object} - Assinatura atualizada
   */
  async updateSubscription(subscriptionId, customerId, status, value, nextDueDate, cycle) {
    try {
      // Buscar assinatura existente
      let subscription = await Subscription.findOne({ where: { externalId: subscriptionId } });
      
      if (subscription) {
        // Atualizar assinatura existente
        subscription = await subscription.update({
          status,
          value,
          nextDueDate: new Date(nextDueDate),
          cycle,
          lastUpdated: new Date()
        });
        
        logger.info(`Assinatura ${subscriptionId} atualizada com status: ${status}`);
        
        // Atualizar cache do usuário se o status mudar
        if (subscription.userId) {
          await this.updateUserSubscriptionCache(subscription.userId);
        }
        
        return subscription;
      } else {
        // Buscar usuário pelo customerId (ID do cliente Asaas)
        const user = await User.findOne({ where: { asaasCustomerId: customerId } });
        
        if (!user) {
          logger.warn(`Nenhum usuário encontrado com customerId Asaas: ${customerId}`);
          throw new Error(`Usuário não encontrado para customerId: ${customerId}`);
        }
        
        // Criar nova assinatura
        subscription = await Subscription.create({
          userId: user.id,
          externalId: subscriptionId,
          provider: 'ASAAS',
          customerId,
          status,
          value,
          nextDueDate: new Date(nextDueDate),
          cycle,
          createdAt: new Date(),
          lastUpdated: new Date()
        });
        
        logger.info(`Nova assinatura ${subscriptionId} criada para usuário ${user.id}`);
        
        // Atualizar cache do usuário
        await this.updateUserSubscriptionCache(user.id);
        
        return subscription;
      }
    } catch (error) {
      logger.error(`Erro ao atualizar assinatura ${subscriptionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Atualiza ou cria um registro de pagamento com base nas informações do webhook
   * @param {string} paymentId - ID do pagamento
   * @param {string} status - Status do pagamento
   * @param {string} customerId - ID do cliente na Asaas
   * @param {string} subscriptionId - ID da assinatura (opcional)
   * @returns {Object} - Pagamento atualizado
   */
  async updatePaymentStatus(paymentId, status, customerId, subscriptionId = null) {
    try {
      // Buscar pagamento existente
      let payment = await Payment.findOne({ where: { externalId: paymentId } });
      
      if (payment) {
        // Atualizar pagamento existente
        payment = await payment.update({
          status,
          lastUpdated: new Date()
        });
        
        logger.info(`Pagamento ${paymentId} atualizado com status: ${status}`);
        
        // Se o pagamento estiver associado a uma assinatura, verificar se precisa atualizar
        if (payment.subscriptionId) {
          await this.checkAndUpdateSubscriptionStatus(payment.subscriptionId);
        }
        
        // Se o pagamento está associado a um usuário, atualizar cache
        if (payment.userId) {
          await this.updateUserPaymentCache(payment.userId);
        }
        
        return payment;
      } else {
        // Precisamos encontrar a assinatura ou o usuário para este pagamento
        let userId = null;
        let subscriptionRecord = null;
        
        // Se temos um ID de assinatura, tentar encontrar a assinatura primeiro
        if (subscriptionId) {
          subscriptionRecord = await Subscription.findOne({ 
            where: { externalId: subscriptionId } 
          });
          
          if (subscriptionRecord) {
            userId = subscriptionRecord.userId;
          }
        }
        
        // Se não encontramos a assinatura, tentar encontrar o usuário pelo customerId
        if (!userId) {
          const user = await User.findOne({ where: { asaasCustomerId: customerId } });
          
          if (user) {
            userId = user.id;
          } else {
            logger.warn(`Nenhum usuário ou assinatura encontrado para o pagamento ${paymentId}`);
            throw new Error('Usuário ou assinatura não encontrado para o pagamento');
          }
        }
        
        // Criar novo registro de pagamento
        payment = await Payment.create({
          userId,
          externalId: paymentId,
          subscriptionId: subscriptionRecord ? subscriptionRecord.id : null,
          externalSubscriptionId: subscriptionId,
          provider: 'ASAAS',
          status,
          createdAt: new Date(),
          lastUpdated: new Date()
        });
        
        logger.info(`Novo pagamento ${paymentId} registrado para usuário ${userId}`);
        
        // Se o pagamento está associado a uma assinatura, verificar se precisa atualizar
        if (subscriptionRecord) {
          await this.checkAndUpdateSubscriptionStatus(subscriptionRecord.id);
        }
        
        // Atualizar cache do usuário
        await this.updateUserPaymentCache(userId);
        
        return payment;
      }
    } catch (error) {
      logger.error(`Erro ao atualizar pagamento ${paymentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Verifica e atualiza o status de uma assinatura com base nos pagamentos
   * @param {string} subscriptionId - ID da assinatura
   */
  async checkAndUpdateSubscriptionStatus(subscriptionId) {
    try {
      const subscription = await Subscription.findByPk(subscriptionId);
      
      if (!subscription) {
        logger.warn(`Assinatura ${subscriptionId} não encontrada para atualização de status`);
        return;
      }
      
      // Buscar pagamentos recentes para esta assinatura
      const recentPayments = await Payment.findAll({
        where: {
          subscriptionId: subscription.id
        },
        order: [['createdAt', 'DESC']],
        limit: 5
      });
      
      if (recentPayments.length === 0) {
        logger.info(`Nenhum pagamento encontrado para assinatura ${subscriptionId}`);
        return;
      }
      
      const latestPayment = recentPayments[0];
      
      // Lógica para determinar o status da assinatura com base nos pagamentos
      let newStatus = subscription.status;
      
      if (latestPayment.status === 'CONFIRMED' || latestPayment.status === 'RECEIVED') {
        newStatus = 'ACTIVE';
      } else if (latestPayment.status === 'OVERDUE') {
        // Verificar se todos os pagamentos recentes estão em atraso
        const allOverdue = recentPayments.every(payment => 
          payment.status === 'OVERDUE' || payment.status === 'CANCELLED');
        
        if (allOverdue) {
          newStatus = 'INACTIVE';
        }
      } else if (latestPayment.status === 'CANCELLED' || latestPayment.status === 'REFUNDED') {
        // Verificar se este é o único pagamento ou se todos estão cancelados
        const allCancelled = recentPayments.every(payment => 
          payment.status === 'CANCELLED' || payment.status === 'REFUNDED');
        
        if (allCancelled) {
          newStatus = 'CANCELLED';
        }
      }
      
      // Atualizar apenas se o status mudou
      if (newStatus !== subscription.status) {
        await subscription.update({
          status: newStatus,
          lastUpdated: new Date()
        });
        
        logger.info(`Status da assinatura ${subscriptionId} atualizado para ${newStatus} 
          com base nos pagamentos recentes`);
        
        // Atualizar cache do usuário
        await this.updateUserSubscriptionCache(subscription.userId);
      }
    } catch (error) {
      logger.error(`Erro ao verificar status da assinatura ${subscriptionId}:`, error);
    }
  }
  
  /**
   * Atualiza o cache de assinaturas de um usuário
   * @param {number} userId - ID do usuário
   */
  async updateUserSubscriptionCache(userId) {
    try {
      // Esta é apenas uma implementação de exemplo
      // A implementação real dependerá do sistema de cache utilizado
      logger.info(`Cache de assinaturas atualizado para usuário ${userId}`);
      
      // Aqui você poderia atualizar Redis, memcached, ou outro sistema de cache
    } catch (error) {
      logger.error(`Erro ao atualizar cache de assinaturas para usuário ${userId}:`, error);
    }
  }
  
  /**
   * Atualiza o cache de pagamentos de um usuário
   * @param {number} userId - ID do usuário
   */
  async updateUserPaymentCache(userId) {
    try {
      // Esta é apenas uma implementação de exemplo
      // A implementação real dependerá do sistema de cache utilizado
      logger.info(`Cache de pagamentos atualizado para usuário ${userId}`);
      
      // Aqui você poderia atualizar Redis, memcached, ou outro sistema de cache
    } catch (error) {
      logger.error(`Erro ao atualizar cache de pagamentos para usuário ${userId}:`, error);
    }
  }
  
  /**
   * Verifica se um usuário possui uma assinatura ativa
   * @param {number} userId - ID do usuário
   * @returns {boolean} - Verdadeiro se o usuário possui uma assinatura ativa
   */
  async hasActiveSubscription(userId) {
    try {
      const subscription = await Subscription.findOne({
        where: {
          userId,
          status: 'ACTIVE'
        }
      });
      
      return !!subscription;
    } catch (error) {
      logger.error(`Erro ao verificar assinatura para usuário ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Obtém informações detalhadas sobre as assinaturas de um usuário
   * @param {number} userId - ID do usuário
   * @returns {Object} - Informações sobre as assinaturas do usuário
   */
  async getUserSubscriptions(userId) {
    try {
      const subscriptions = await Subscription.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']]
      });
      
      // Buscar pagamentos recentes para cada assinatura
      const result = await Promise.all(subscriptions.map(async (subscription) => {
        const payments = await Payment.findAll({
          where: { subscriptionId: subscription.id },
          order: [['createdAt', 'DESC']],
          limit: 5
        });
        
        return {
          ...subscription.toJSON(),
          recentPayments: payments.map(p => p.toJSON())
        };
      }));
      
      return result;
    } catch (error) {
      logger.error(`Erro ao buscar assinaturas do usuário ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Obtém informações sobre pagamentos de um usuário
   * @param {number} userId - ID do usuário
   * @param {Object} filters - Filtros para a busca
   * @returns {Array} - Lista de pagamentos do usuário
   */
  async getUserPayments(userId, filters = {}) {
    try {
      const where = { userId };
      
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.startDate && filters.endDate) {
        where.createdAt = {
          [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
        };
      }
      
      const payments = await Payment.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: filters.limit || 20,
        offset: filters.offset || 0
      });
      
      return payments;
    } catch (error) {
      logger.error(`Erro ao buscar pagamentos do usuário ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = new SubscriptionService(); 