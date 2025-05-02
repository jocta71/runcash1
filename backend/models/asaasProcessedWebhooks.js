/**
 * Modelo para a coleção de webhooks processados do Asaas
 * Utilizado para controle de idempotência
 */

const getDb = require('../services/database');

/**
 * Verifica se um evento já foi processado
 * @param {string} eventId - ID do evento do Asaas
 * @returns {Promise<boolean>} - Verdadeiro se o evento já foi processado
 */
async function isEventProcessed(eventId) {
  try {
    const db = await getDb();
    const existing = await db.collection('asaas_processed_webhooks')
      .findOne({ asaas_evt_id: eventId });
    
    return !!existing;
  } catch (error) {
    console.error('Erro ao verificar evento processado:', error);
    return false;
  }
}

/**
 * Registra um evento como processado
 * @param {Object} eventData - Dados do evento
 * @returns {Promise<boolean>} - Verdadeiro se o registro foi bem-sucedido
 */
async function registerProcessedEvent(eventData) {
  try {
    const db = await getDb();
    
    // Registrar o evento com timestamp
    await db.collection('asaas_processed_webhooks').insertOne({
      asaas_evt_id: eventData.id,
      event: eventData.event,
      payload: eventData,
      timestamp: new Date()
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao registrar evento processado:', error);
    return false;
  }
}

/**
 * Inicializa a coleção de webhooks processados
 */
async function setupCollection() {
  try {
    const db = await getDb();
    
    // Verificar se a coleção existe
    const collections = await db.listCollections({ name: 'asaas_processed_webhooks' }).toArray();
    
    if (collections.length === 0) {
      // Criar coleção
      await db.createCollection('asaas_processed_webhooks');
      
      // Criar índice único no ID do evento para garantir idempotência
      await db.collection('asaas_processed_webhooks').createIndex(
        { asaas_evt_id: 1 },
        { unique: true }
      );
      
      // Criar índice de expiração (TTL) para limpar eventos antigos após 30 dias
      await db.collection('asaas_processed_webhooks').createIndex(
        { timestamp: 1 },
        { expireAfterSeconds: 2592000 } // 30 dias em segundos
      );
      
      console.log('Coleção asaas_processed_webhooks criada com sucesso');
    }
  } catch (error) {
    console.error('Erro ao configurar coleção de webhooks do Asaas:', error);
  }
}

// Exportar funções do modelo
module.exports = {
  isEventProcessed,
  registerProcessedEvent,
  setupCollection
}; 