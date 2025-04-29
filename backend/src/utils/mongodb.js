/**
 * Utilitário para conectar e interagir com MongoDB
 */

const { MongoClient } = require('mongodb');
const logger = require('./logger');

// URI de conexão ao MongoDB (usando variável de ambiente ou valor padrão)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'asaas_webhook_db';

// Cliente MongoDB
let client = null;
let db = null;

/**
 * Conecta ao MongoDB
 * @returns {Promise<object>} O cliente MongoDB conectado
 */
async function connect() {
  try {
    if (client) {
      logger.info('Usando conexão existente com MongoDB');
      return client;
    }
    
    logger.info(`Conectando ao MongoDB em: ${MONGODB_URI}`);
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    
    logger.info('Conexão com MongoDB estabelecida com sucesso');
    return client;
  } catch (error) {
    logger.error('Erro ao conectar com MongoDB', error);
    throw error;
  }
}

/**
 * Fecha a conexão com MongoDB
 */
async function close() {
  try {
    if (client) {
      await client.close();
      client = null;
      db = null;
      logger.info('Conexão com MongoDB fechada');
    }
  } catch (error) {
    logger.error('Erro ao fechar conexão com MongoDB', error);
  }
}

/**
 * Obtém um objeto de coleção MongoDB
 * @param {string} collectionName - Nome da coleção
 * @returns {object} A coleção do MongoDB
 */
async function getCollection(collectionName) {
  if (!client || !db) {
    await connect();
  }
  return db.collection(collectionName);
}

/**
 * Guarda um evento de webhook no MongoDB
 * @param {object} event - Evento de webhook para armazenar
 * @returns {Promise<object>} Resultado da operação
 */
async function saveWebhookEvent(event) {
  try {
    const collection = await getCollection('webhook_events');
    event.timestamp = new Date();
    const result = await collection.insertOne(event);
    logger.info(`Evento de webhook armazenado, ID: ${result.insertedId}`);
    return result;
  } catch (error) {
    logger.error('Erro ao salvar evento de webhook', error);
    throw error;
  }
}

/**
 * Atualiza ou cria informações de assinatura
 * @param {string} subscriptionId - ID da assinatura
 * @param {object} data - Dados da assinatura
 * @returns {Promise<object>} Resultado da operação
 */
async function updateSubscription(subscriptionId, data) {
  try {
    const collection = await getCollection('subscriptions');
    data.updatedAt = new Date();
    
    const result = await collection.updateOne(
      { subscriptionId },
      { $set: data },
      { upsert: true }
    );
    
    logger.info(`Assinatura atualizada: ${subscriptionId}`);
    return result;
  } catch (error) {
    logger.error(`Erro ao atualizar assinatura ${subscriptionId}`, error);
    throw error;
  }
}

/**
 * Atualiza ou cria informações de pagamento
 * @param {string} paymentId - ID do pagamento
 * @param {object} data - Dados do pagamento
 * @returns {Promise<object>} Resultado da operação
 */
async function updatePayment(paymentId, data) {
  try {
    const collection = await getCollection('payments');
    data.updatedAt = new Date();
    
    const result = await collection.updateOne(
      { paymentId },
      { $set: data },
      { upsert: true }
    );
    
    logger.info(`Pagamento atualizado: ${paymentId}`);
    return result;
  } catch (error) {
    logger.error(`Erro ao atualizar pagamento ${paymentId}`, error);
    throw error;
  }
}

/**
 * Busca eventos de webhook com filtros opcionais
 * @param {object} filter - Filtro para eventos
 * @param {number} limit - Limite máximo de resultados
 * @returns {Promise<Array>} Lista de eventos
 */
async function getWebhookEvents(filter = {}, limit = 100) {
  try {
    const collection = await getCollection('webhook_events');
    return await collection.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  } catch (error) {
    logger.error('Erro ao buscar eventos de webhook', error);
    throw error;
  }
}

/**
 * Busca uma assinatura pelo ID
 * @param {string} subscriptionId - ID da assinatura
 * @returns {Promise<object>} Dados da assinatura
 */
async function getSubscription(subscriptionId) {
  try {
    const collection = await getCollection('subscriptions');
    return await collection.findOne({ subscriptionId });
  } catch (error) {
    logger.error(`Erro ao buscar assinatura ${subscriptionId}`, error);
    throw error;
  }
}

/**
 * Busca um pagamento pelo ID
 * @param {string} paymentId - ID do pagamento
 * @returns {Promise<object>} Dados do pagamento
 */
async function getPayment(paymentId) {
  try {
    const collection = await getCollection('payments');
    return await collection.findOne({ paymentId });
  } catch (error) {
    logger.error(`Erro ao buscar pagamento ${paymentId}`, error);
    throw error;
  }
}

/**
 * Busca assinaturas de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>} Lista de assinaturas do usuário
 */
async function getUserSubscriptions(userId) {
  try {
    const collection = await getCollection('subscriptions');
    return await collection.find({ 
      $or: [
        { userId },
        { 'customer.id': userId },
        { 'customer.externalReference': userId }
      ]
    }).toArray();
  } catch (error) {
    logger.error(`Erro ao buscar assinaturas do usuário ${userId}`, error);
    throw error;
  }
}

module.exports = {
  connect,
  close,
  getCollection,
  saveWebhookEvent,
  updateSubscription,
  updatePayment,
  getWebhookEvents,
  getSubscription,
  getPayment,
  getUserSubscriptions
}; 