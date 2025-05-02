/**
 * Utilitário para auxiliar nas operações de MongoDB
 * Fornece funções para gerenciar conexões, executar operações com retries,
 * e verificar o estado da conexão
 */
const mongoose = require('mongoose');
const mongoInitializer = require('./mongoInitializer');

// Configurações globais
const DEFAULT_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 3;
const RETRY_DELAY = 500; // 500ms
const OFFLINE_QUEUE_SIZE = 100;

// Fila para operações quando estiver offline
const offlineOperations = [];

// Configuração
const CONNECTION_STRING = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';

/**
 * Verifica o estado atual da conexão
 * @returns {Object} Estado da conexão
 */
function getConnectionStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    status: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
    initialized: mongoInitializer.isReady(),
    offlineQueueSize: offlineOperations.length
  };
}

/**
 * Executar uma operação com retries em caso de falha
 * @param {Function} operation Função assíncrona que realiza a operação no MongoDB
 * @param {Object} options Opções de configuração
 * @returns {Promise} Resultado da operação
 */
async function withRetry(operation, options = {}) {
  const maxRetries = options.maxRetries || MAX_RETRIES;
  const retryDelay = options.retryDelay || RETRY_DELAY;
  let lastError = null;

  // Verificar se a conexão está pronta antes de tentar executar a operação
  if (!mongoInitializer.isReady()) {
    try {
      console.log('[MongoDB] Aguardando conexão antes de executar operação...');
      await mongoInitializer.waitForConnection(options.connectionTimeout || DEFAULT_TIMEOUT);
    } catch (connectionError) {
      console.error('[MongoDB] Erro ao aguardar conexão:', connectionError);
      
      // Se a operação for obrigatória e tiver uma função de fallback, usar o fallback
      if (options.critical && options.fallback) {
        console.warn('[MongoDB] Usando fallback para operação crítica');
        return options.fallback();
      }
      
      // Se a operação for obrigatória e não tiver fallback, adicionar à fila offline
      if (options.critical) {
        if (offlineOperations.length < OFFLINE_QUEUE_SIZE) {
          console.warn('[MongoDB] Adicionando operação à fila offline para execução posterior');
          offlineOperations.push({ operation, options });
        } else {
          console.error('[MongoDB] Fila offline cheia, operação descartada');
        }
      }
      
      throw new Error(`Não foi possível conectar ao MongoDB: ${connectionError.message}`);
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[MongoDB] Tentativa ${attempt}/${maxRetries} para operação`);
      }
      
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Verificar se é um erro que vale a pena tentar novamente
      if (error.name === 'MongooseError' || 
          error.name === 'MongoTimeoutError' || 
          error.name === 'MongoNetworkError' ||
          error.message.includes('buffering timed out')) {
        console.warn(`[MongoDB] Erro temporário (tentativa ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt < maxRetries) {
          // Aguardar antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }
      } else {
        // Erro não recuperável, não tentar novamente
        console.error(`[MongoDB] Erro não recuperável:`, error);
        break;
      }
    }
  }
  
  // Se chegamos aqui, todas as tentativas falharam
  console.error(`[MongoDB] Todas as ${maxRetries} tentativas falharam para a operação`);
  
  // Se a operação for crítica, adicionar à fila offline para tentar novamente depois
  if (options.critical) {
    if (offlineOperations.length < OFFLINE_QUEUE_SIZE) {
      console.warn('[MongoDB] Adicionando operação crítica à fila offline para execução posterior');
      offlineOperations.push({ operation, options });
    } else {
      console.error('[MongoDB] Fila offline cheia, operação crítica descartada');
    }
  }
  
  throw lastError;
}

/**
 * Verifica se um modelo está disponível e tenta carregá-lo se não estiver
 * @param {string} modelName Nome do modelo
 * @returns {Object} Modelo Mongoose
 */
function getModel(modelName) {
  try {
    // Tentar obter o modelo
    return mongoose.model(modelName);
  } catch (error) {
    console.warn(`[MongoDB] Modelo ${modelName} não disponível:`, error.message);
    
    try {
      // Tentar carregar o modelo
      require(`../models/${modelName}`);
      return mongoose.model(modelName);
    } catch (loadError) {
      console.error(`[MongoDB] Não foi possível carregar o modelo ${modelName}:`, loadError.message);
      
      // Criar um modelo de fallback que registra operações
      const fallbackSchema = new mongoose.Schema({}, { strict: false });
      try {
        return mongoose.model(modelName, fallbackSchema);
      } catch (e) {
        console.error(`[MongoDB] Não foi possível criar modelo de fallback:`, e.message);
        throw new Error(`Modelo ${modelName} não disponível e não foi possível criar fallback`);
      }
    }
  }
}

/**
 * Executar uma operação find em um modelo com retries
 * @param {string} modelName Nome do modelo
 * @param {Object} query Consulta MongoDB
 * @param {Object} options Opções de configuração
 * @returns {Promise<Array>} Resultados da consulta
 */
async function findWithRetry(modelName, query = {}, options = {}) {
  const model = getModel(modelName);
  
  return withRetry(async () => {
    const queryObj = model.find(query);
    
    if (options.select) queryObj.select(options.select);
    if (options.sort) queryObj.sort(options.sort);
    if (options.limit) queryObj.limit(options.limit);
    if (options.skip) queryObj.skip(options.skip);
    if (options.populate) queryObj.populate(options.populate);
    
    return await queryObj.exec();
  }, options);
}

/**
 * Executar uma operação findOne em um modelo com retries
 * @param {string} modelName Nome do modelo
 * @param {Object} query Consulta MongoDB
 * @param {Object} options Opções de configuração
 * @returns {Promise<Object>} Documento encontrado ou null
 */
async function findOneWithRetry(modelName, query = {}, options = {}) {
  const model = getModel(modelName);
  
  return withRetry(async () => {
    const queryObj = model.findOne(query);
    
    if (options.select) queryObj.select(options.select);
    if (options.populate) queryObj.populate(options.populate);
    
    return await queryObj.exec();
  }, options);
}

/**
 * Criar um documento com retry em caso de falha
 * @param {string} modelName Nome do modelo
 * @param {Object} data Dados para criar o documento
 * @param {Object} options Opções de configuração
 * @returns {Promise<Object>} Documento criado
 */
async function createWithRetry(modelName, data, options = {}) {
  const model = getModel(modelName);
  
  return withRetry(async () => {
    return await model.create(data);
  }, options);
}

/**
 * Atualizar um documento com retry em caso de falha
 * @param {string} modelName Nome do modelo
 * @param {Object} query Consulta para encontrar o documento
 * @param {Object} update Atualizações a serem aplicadas
 * @param {Object} options Opções de configuração
 * @returns {Promise<Object>} Resultado da atualização
 */
async function updateWithRetry(modelName, query, update, options = {}) {
  const model = getModel(modelName);
  
  return withRetry(async () => {
    return await model.updateOne(query, update, options);
  }, options);
}

/**
 * Verificar se um documento existe, com retry em caso de falha
 * @param {string} modelName Nome do modelo
 * @param {Object} query Consulta MongoDB
 * @param {Object} options Opções de configuração
 * @returns {Promise<boolean>} Verdadeiro se o documento existe
 */
async function existsWithRetry(modelName, query, options = {}) {
  const model = getModel(modelName);
  
  return withRetry(async () => {
    const count = await model.countDocuments(query).limit(1);
    return count > 0;
  }, options);
}

/**
 * Processa a fila de operações offline
 * @returns {Promise<number>} Número de operações processadas com sucesso
 */
async function processOfflineQueue() {
  if (offlineOperations.length === 0) {
    return 0;
  }
  
  if (!mongoInitializer.isReady()) {
    console.warn('[MongoDB] Conexão não está pronta, não é possível processar fila offline');
    return 0;
  }
  
  console.log(`[MongoDB] Processando fila offline (${offlineOperations.length} operações)...`);
  let processed = 0;
  
  // Clonar a lista para evitar mudanças durante o processamento
  const operationsToProcess = [...offlineOperations];
  
  // Limpar fila original
  offlineOperations.length = 0;
  
  for (const { operation, options } of operationsToProcess) {
    try {
      await withRetry(operation, options);
      processed++;
    } catch (error) {
      console.error('[MongoDB] Erro ao processar operação da fila offline:', error);
      
      // Adicionar de volta à fila se ainda for um erro temporário
      if (
        error.name === 'MongooseError' || 
        error.name === 'MongoTimeoutError' || 
        error.name === 'MongoNetworkError' ||
        error.message.includes('buffering timed out')
      ) {
        if (offlineOperations.length < OFFLINE_QUEUE_SIZE) {
          offlineOperations.push({ operation, options });
        }
      }
    }
  }
  
  console.log(`[MongoDB] Processamento de fila offline concluído: ${processed}/${operationsToProcess.length} operações processadas`);
  return processed;
}

// Configurar processamento automático da fila offline quando a conexão for estabelecida
mongoose.connection.on('connected', () => {
  console.log('[MongoDB] Conexão estabelecida, verificando fila offline...');
  if (offlineOperations.length > 0) {
    setTimeout(() => {
      processOfflineQueue().catch(err => {
        console.error('[MongoDB] Erro ao processar fila offline automaticamente:', err);
      });
    }, 1000); // Aguardar 1 segundo para garantir que a conexão está estável
  }
});

module.exports = {
  getConnectionStatus,
  withRetry,
  getModel,
  findWithRetry,
  findOneWithRetry,
  createWithRetry,
  updateWithRetry,
  existsWithRetry,
  processOfflineQueue
}; 