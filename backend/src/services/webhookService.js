// Serviço para gerenciamento de eventos webhook
// Para armazenamento persistente, substitua por banco de dados em produção

const mongoose = require('mongoose');
const WebhookEvent = require('../models/WebhookEvent');
const logger = require('../utils/logger');
const subscriptionService = require('./subscriptionService');
const { Op } = require('sequelize');

/**
 * Serviço para gerenciar eventos de webhook
 */
const storage = {
  events: [],
  subscriptions: {},
  payments: {}
};

// Limite de eventos a serem armazenados
const EVENT_HISTORY_LIMIT = 100;

/**
 * Serviço para gerenciar webhooks
 */
class WebhookService {
  /**
   * Verifica se um evento de webhook já foi processado (idempotência)
   * @param {string} provider - Provedor do webhook (ex: ASAAS)
   * @param {string} eventId - ID do evento
   * @param {string} eventType - Tipo do evento
   * @returns {boolean} - Verdadeiro se o evento já foi processado
   */
  async isEventProcessed(provider, eventId, eventType) {
    try {
      const event = await WebhookEvent.findOne({
        where: {
          provider,
          eventId,
          eventType,
          status: 'PROCESSED'
        }
      });
      
      return !!event;
    } catch (error) {
      logger.error(`Erro ao verificar evento processado [${provider}:${eventId}]:`, error);
      return false;
    }
  }
  
  /**
   * Registra um novo evento de webhook
   * @param {Object} event - Evento de webhook
   * @returns {Object} Evento registrado
   */
  recordEvent(event) {
    // Adiciona timestamp e ID único
    const timestamp = new Date();
    const eventId = `evt_${timestamp.getTime()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Cria o objeto de evento estruturado
    const webhookEvent = {
      id: eventId,
      timestamp,
      processed: false,
      processingErrors: [],
      ...event
    };
    
    // Adiciona ao início do array para ter os mais recentes primeiro
    storage.events.unshift(webhookEvent);
    
    // Limita o tamanho do histórico
    if (storage.events.length > EVENT_HISTORY_LIMIT) {
      storage.events = storage.events.slice(0, EVENT_HISTORY_LIMIT);
    }
    
    logger.info(`Webhook event recorded: ${eventId} (${event.event})`);
    return webhookEvent;
  }
  
  /**
   * Marca um evento como processado
   * @param {string} eventId - ID do evento
   * @param {boolean} success - Indicador de sucesso
   * @param {string} error - Mensagem de erro, se houver
   */
  markEventProcessed(eventId, success = true, error = null) {
    const event = this.getEvent(eventId);
    if (event) {
      event.processed = true;
      event.processedAt = new Date();
      event.success = success;
      
      if (error) {
        event.processingErrors.push({
          timestamp: new Date(),
          message: error
        });
        logger.error(`Error processing webhook event ${eventId}: ${error}`);
      } else {
        logger.info(`Webhook event ${eventId} processed successfully`);
      }
    }
  }
  
  /**
   * Busca um evento específico
   * @param {string} eventId - ID do evento
   * @returns {Object} Evento encontrado ou null
   */
  getEvent(eventId) {
    return storage.events.find(e => e.id === eventId);
  }
  
  /**
   * Busca eventos com filtros
   * @param {Object} filters - Filtros a serem aplicados
   * @returns {Array} Lista de eventos filtrados
   */
  listEvents(filters = {}) {
    let filteredEvents = [...storage.events];
    
    if (filters.type) {
      filteredEvents = filteredEvents.filter(e => e.event === filters.type);
    }
    
    if (filters.processed !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.processed === filters.processed);
    }
    
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filteredEvents = filteredEvents.filter(e => new Date(e.timestamp) >= startDate);
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      filteredEvents = filteredEvents.filter(e => new Date(e.timestamp) <= endDate);
    }
    
    // Aplicar paginação se fornecida
    if (filters.limit) {
      const start = filters.offset || 0;
      const end = start + parseInt(filters.limit);
      filteredEvents = filteredEvents.slice(start, end);
    }
    
    return filteredEvents;
  }
  
  /**
   * Obtém estatísticas dos eventos de webhook
   * @returns {Object} Estatísticas dos eventos
   */
  getStats() {
    const totalEvents = storage.events.length;
    const processedEvents = storage.events.filter(e => e.processed).length;
    const failedEvents = storage.events.filter(e => e.processed && !e.success).length;
    
    // Agrupar por tipo de evento
    const eventTypes = {};
    storage.events.forEach(event => {
      const type = event.event || 'unknown';
      eventTypes[type] = (eventTypes[type] || 0) + 1;
    });
    
    return {
      totalEvents,
      processedEvents,
      failedEvents,
      pendingEvents: totalEvents - processedEvents,
      eventTypes
    };
  }
  
  /**
   * Atualiza o cache de inscrições
   * @param {string} subscriptionId - ID da inscrição
   * @param {Object} data - Dados da inscrição
   */
  updateSubscription(subscriptionId, data) {
    if (!subscriptionId) {
      logger.warn('Attempted to update subscription without ID');
      return;
    }
    
    // Mescla com dados existentes ou cria novo registro
    storage.subscriptions[subscriptionId] = {
      ...this.getSubscription(subscriptionId),
      ...data,
      updatedAt: new Date()
    };
    
    logger.info(`Subscription updated: ${subscriptionId} (${data.status || 'unknown status'})`);
  }
  
  /**
   * Obtém uma inscrição do cache
   * @param {string} subscriptionId - ID da inscrição
   * @returns {Object} Dados da inscrição ou objeto vazio
   */
  getSubscription(subscriptionId) {
    return storage.subscriptions[subscriptionId] || {};
  }
  
  /**
   * Obtém todas as inscrições de um usuário específico
   * @param {string} customerId - ID do cliente/usuário
   * @returns {Array} Lista de inscrições do usuário
   */
  getUserSubscriptions(customerId) {
    if (!customerId) return [];
    
    return Object.values(storage.subscriptions)
      .filter(sub => sub.customer === customerId)
      .sort((a, b) => {
        const dateA = new Date(a.updatedAt || 0);
        const dateB = new Date(b.updatedAt || 0);
        return dateB - dateA; // Ordenação decrescente (mais recente primeiro)
      });
  }
  
  /**
   * Verifica se um usuário tem uma inscrição ativa
   * @param {string} customerId - ID do cliente/usuário
   * @returns {boolean} Verdadeiro se tiver inscrição ativa
   */
  hasActiveSubscription(customerId) {
    if (!customerId) return false;
    
    return Object.values(storage.subscriptions).some(sub => 
      sub.customer === customerId && 
      sub.status === 'ACTIVE'
    );
  }
  
  /**
   * Atualiza o cache de pagamentos
   * @param {string} paymentId - ID do pagamento
   * @param {Object} data - Dados do pagamento
   */
  updatePayment(paymentId, data) {
    if (!paymentId) {
      logger.warn('Attempted to update payment without ID');
      return;
    }
    
    // Mescla com dados existentes ou cria novo registro
    storage.payments[paymentId] = {
      ...this.getPayment(paymentId),
      ...data,
      updatedAt: new Date()
    };
    
    logger.info(`Payment updated: ${paymentId} (${data.status || 'unknown status'})`);
  }
  
  /**
   * Obtém um pagamento do cache
   * @param {string} paymentId - ID do pagamento
   * @returns {Object} Dados do pagamento ou objeto vazio
   */
  getPayment(paymentId) {
    return storage.payments[paymentId] || {};
  }
  
  /**
   * Obtém todos os pagamentos de um usuário específico
   * @param {string} customerId - ID do cliente/usuário
   * @returns {Array} Lista de pagamentos do usuário
   */
  getUserPayments(customerId) {
    if (!customerId) return [];
    
    return Object.values(storage.payments)
      .filter(payment => payment.customer === customerId)
      .sort((a, b) => {
        const dateA = new Date(a.dueDate || a.updatedAt || 0);
        const dateB = new Date(b.dueDate || b.updatedAt || 0);
        return dateB - dateA; // Ordenação decrescente (mais recente primeiro)
      });
  }
  
  /**
   * Verifica se um pagamento específico foi confirmado
   * @param {string} paymentId - ID do pagamento
   * @returns {boolean} Verdadeiro se o pagamento foi confirmado
   */
  isPaymentConfirmed(paymentId) {
    const payment = this.getPayment(paymentId);
    return payment && payment.status === 'CONFIRMED';
  }
}

module.exports = new WebhookService(); 