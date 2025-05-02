/**
 * Utilitário para inicialização e configuração do MongoDB
 * Garante que a conexão seja estabelecida antes de operações críticas
 */
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Configurações globais
const CONNECTION_TIMEOUT = 30000; // 30 segundos
let isInitialized = false;
let isConnected = false;
let connectionPromise = null;
let modelsRegistered = false;
let reconnectAttempt = 0;
let reconnectInterval = null;

// Configuração
const CONNECTION_STRING = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';

/**
 * Verifica se a conexão está inicializada e pronta para uso
 * @returns {boolean} Verdadeiro se a conexão estiver pronta
 */
function isReady() {
  // Verificar se há uma conexão global do mongoose já estabelecida
  if (mongoose.connection.readyState === 1) {
    // Se a conexão está ativa, verificar se há pelo menos modelos essenciais registrados
    try {
      const essentialModels = ['User', 'Subscription', 'Payment', 'WebhookEvent'];
      const availableModels = mongoose.modelNames();
      
      // Se pelo menos um modelo essencial está disponível, considerar como pronto
      for (const model of essentialModels) {
        if (availableModels.includes(model)) {
          // Logging para diagnóstico
          console.log(`[MongoInitializer] isReady(): Conexão ativa e modelo ${model} disponível, retornando true`);
          return true;
        }
      }
      
      // Se chegou aqui, a conexão está ativa, mas talvez os modelos não estejam registrados
      console.log('[MongoInitializer] isReady(): Conexão ativa mas modelos podem não estar prontos, verificando registro...');
      
      // Se modelsRegistered já é true, retornar true
      if (modelsRegistered) {
        console.log('[MongoInitializer] isReady(): Flag modelsRegistered já é true, retornando true');
        return true;
      }
      
      // Se a conexão está ativa mas os modelos não estão registrados, forçar registro de modelos
      // Esta é uma chamada síncrona para não atrasar a resposta
      console.log('[MongoInitializer] isReady(): Tentando registrar modelos automaticamente');
      registerModelsSync();
      return true;
    } catch (error) {
      console.error('[MongoInitializer] Erro ao verificar isReady():', error);
      // Em caso de erro, se a conexão estiver ativa, considerar como pronto
      return true;
    }
  }
  
  // Caso a conexão não esteja ativa, usar a lógica original
  const ready = isInitialized && isConnected && modelsRegistered;
  console.log(`[MongoInitializer] isReady(): isInitialized=${isInitialized}, isConnected=${isConnected}, modelsRegistered=${modelsRegistered}, resultado=${ready}`);
  return ready;
}

// Versão síncrona simplificada do registro de modelos para uso em isReady()
function registerModelsSync() {
  try {
    // Verificar modelos já registrados globalmente
    const existingModels = mongoose.modelNames();
    if (existingModels.length > 0) {
      console.log(`[MongoInitializer] Modelos já registrados globalmente: ${existingModels.join(', ')}`);
      modelsRegistered = true;
      return true;
    }
    
    // Tentar registrar modelos essenciais
    const essentialModels = ['User', 'Subscription', 'Payment', 'Checkout', 'WebhookEvent'];
    let registeredCount = 0;
    
    for (const model of essentialModels) {
      try {
        // Verificar se o modelo já está registrado
        try {
          mongoose.model(model);
          registeredCount++;
        } catch (notFound) {
          // Modelo não encontrado, carregar explicitamente
          try {
            require(path.join(__dirname, '..', 'models', model));
            registeredCount++;
          } catch (e) {
            // Se falhar, tentar via arquivos
            const modelFiles = fs.readdirSync(path.join(__dirname, '..', 'models'))
              .filter(f => f.includes(model) && f.endsWith('.js'));
            
            if (modelFiles.length > 0) {
              try {
                require(path.join(__dirname, '..', 'models', modelFiles[0]));
                registeredCount++;
              } catch (loadError) {
                console.error(`[MongoInitializer] Erro ao carregar modelo ${model} via arquivo:`, loadError);
              }
            } 
          }
        }
      } catch (error) {
        console.error(`[MongoInitializer] Erro ao registrar modelo ${model} de forma síncrona:`, error);
      }
    }
    
    modelsRegistered = (registeredCount > 0);
    console.log(`[MongoInitializer] Registro síncrono de modelos: ${registeredCount}/${essentialModels.length} modelos registrados`);
    return modelsRegistered;
  } catch (error) {
    console.error('[MongoInitializer] Erro no registro síncrono de modelos:', error);
    return false;
  }
}

/**
 * Inicializa a conexão com o MongoDB
 * @param {string} uri URI do MongoDB
 * @param {Object} options Opções do Mongoose
 * @returns {Promise} Promessa que resolve quando a conexão estiver pronta
 */
async function initialize(uri, options = {}) {
  // Verificar se já existe uma conexão global do mongoose ativa
  if (mongoose.connection.readyState === 1) {
    console.log('[MongoInitializer] Usando conexão Mongoose global existente');
    isConnected = true;
    isInitialized = true;
    
    // Garantir que modelos estão registrados na conexão existente
    if (!modelsRegistered) {
      modelsRegistered = await registerModels();
      console.log(`[MongoInitializer] Registro de modelos na conexão existente: ${modelsRegistered ? 'SUCESSO' : 'FALHA'}`);
    }
    
    return Promise.resolve(mongoose.connection);
  }
  
  // Se já existe uma promessa de conexão em andamento, retorná-la
  if (connectionPromise) {
    return connectionPromise;
  }
  
  console.log('[MongoInitializer] Iniciando conexão com MongoDB...');
  
  // Definir configurações padrão se não fornecidas
  const defaultOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: CONNECTION_TIMEOUT,
    socketTimeoutMS: CONNECTION_TIMEOUT,
    connectTimeoutMS: CONNECTION_TIMEOUT,
    keepAlive: true,
    keepAliveInitialDelay: 300000
  };
  
  const connectionOptions = { ...defaultOptions, ...options };
  
  // Armazenar as opções para reconexão automática
  const storedUri = uri || CONNECTION_STRING;
  const storedOptions = connectionOptions;
  
  // Criar e armazenar a promessa de conexão
  connectionPromise = new Promise((resolve, reject) => {
    // Configurar handlers para eventos de conexão
    mongoose.connection.on('connected', () => {
      console.log('[MongoInitializer] Conexão MongoDB estabelecida com sucesso');
      isConnected = true;
      isInitialized = true;
      reconnectAttempt = 0; // Resetar contador de tentativas
      
      // Auto-registrar modelos após conexão bem-sucedida
      if (!modelsRegistered) {
        registerModels().then(success => {
          modelsRegistered = success;
          console.log(`[MongoInitializer] Auto-registro de modelos: ${success ? 'SUCESSO' : 'FALHA'}`);
        });
      }
      
      // Configurar verificação periódica da conexão
      startConnectionChecker(storedUri, storedOptions);
      
      resolve(mongoose.connection);
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('[MongoInitializer] Erro na conexão MongoDB:', err);
      if (!isInitialized) {
        isInitialized = true;
        reject(err);
      } else {
        // Se já inicializado, tentar reconectar automaticamente
        attemptReconnect(storedUri, storedOptions);
      }
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoInitializer] Desconectado do MongoDB');
      isConnected = false;
      
      // Tentar reconectar automaticamente
      attemptReconnect(storedUri, storedOptions);
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('[MongoInitializer] Reconectado ao MongoDB');
      isConnected = true;
      reconnectAttempt = 0; // Resetar contador de tentativas
    });
    
    // Tentar conectar
    mongoose.connect(storedUri, connectionOptions).catch(err => {
      if (!isInitialized) {
        isInitialized = true;
        reject(err);
      } else {
        // Se já inicializado, tentar reconectar automaticamente
        attemptReconnect(storedUri, storedOptions);
      }
    });
  });
  
  return connectionPromise;
}

/**
 * Tenta reconectar ao MongoDB com backoff exponencial
 * @param {string} uri URI do MongoDB
 * @param {Object} options Opções de conexão
 */
function attemptReconnect(uri, options) {
  // Evitar múltiplas tentativas simultâneas
  if (mongoose.connection.readyState === 2) { // Conectando
    console.log('[MongoInitializer] Já existe uma tentativa de reconexão em andamento');
    return;
  }
  
  // Calcular tempo de espera com backoff exponencial
  reconnectAttempt++;
  const baseDelay = 1000; // 1 segundo inicial
  const maxDelay = 30000; // Máximo de 30 segundos
  const delay = Math.min(baseDelay * Math.pow(1.5, reconnectAttempt), maxDelay);
  
  console.log(`[MongoInitializer] Tentando reconectar ao MongoDB em ${delay/1000} segundos (tentativa ${reconnectAttempt})`);
  
  setTimeout(() => {
    if (!isConnected && mongoose.connection.readyState !== 2) {
      console.log(`[MongoInitializer] Iniciando reconexão (tentativa ${reconnectAttempt})`);
      try {
        mongoose.connect(uri, options).catch(err => {
          console.error('[MongoInitializer] Falha na tentativa de reconexão:', err);
        });
      } catch (error) {
        console.error('[MongoInitializer] Erro ao tentar reconectar:', error);
      }
    }
  }, delay);
}

/**
 * Inicia um verificador periódico de conexão para garantir que o MongoDB está conectado
 * @param {string} uri URI do MongoDB para reconectar se necessário
 * @param {Object} options Opções de conexão para reconectar
 */
function startConnectionChecker(uri, options) {
  // Limpar intervalo anterior se existir
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
  }
  
  // Verificar a cada 30 segundos
  reconnectInterval = setInterval(() => {
    // Verificar estado atual da conexão
    const readyState = mongoose.connection.readyState;
    
    // Se não estiver conectado (0 = desconectado, 3 = desconectando), tentar reconectar
    if (readyState === 0 || readyState === 3) {
      console.log('[MongoInitializer] Verificação periódica detectou que MongoDB está desconectado');
      isConnected = false;
      attemptReconnect(uri, options);
    }
  }, 30000); // Verificar a cada 30 segundos
  
  console.log('[MongoInitializer] Verificador periódico de conexão iniciado');
}

/**
 * Aguarda até que a conexão esteja pronta
 * @param {number} timeoutMs Tempo máximo de espera em ms
 * @returns {Promise} Promessa que resolve quando a conexão estiver pronta
 */
async function waitForConnection(timeoutMs = 10000) {
  // Se a conexão global do mongoose já está pronta, usar ela
  if (mongoose.connection.readyState === 1) {
    console.log('[MongoInitializer] Usando conexão Mongoose global existente');
    isConnected = true;
    isInitialized = true;
    
    // Garantir que modelos estão registrados
    if (!modelsRegistered) {
      modelsRegistered = await registerModels();
    }
    
    return mongoose.connection;
  }
  
  if (isReady()) {
    return Promise.resolve(mongoose.connection);
  }
  
  if (!connectionPromise) {
    // Tentar inicializar conexão automaticamente
    try {
      console.log('[MongoInitializer] Iniciando conexão automaticamente');
      return await initialize(CONNECTION_STRING);
    } catch (error) {
      return Promise.reject(new Error('Falha ao inicializar conexão MongoDB: ' + error.message));
    }
  }
  
  // Adicionar timeout à espera
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout (${timeoutMs}ms) esperando pela conexão MongoDB`)), timeoutMs);
  });
  
  try {
    await Promise.race([connectionPromise, timeoutPromise]);
    // Após conexão, garantir que modelos estejam registrados
    if (!modelsRegistered) {
      modelsRegistered = await registerModels();
    }
    return mongoose.connection;
  } catch (error) {
    throw error;
  }
}

/**
 * Carrega e registra todos os modelos do mongoose
 * @returns {Promise<boolean>} Verdadeiro se todos os modelos foram carregados
 */
async function registerModels() {
  console.log('[MongoInitializer] Registrando modelos Mongoose...');
  try {
    // Verificar modelos já registrados globalmente
    const existingModels = mongoose.modelNames();
    if (existingModels.length > 0) {
      console.log(`[MongoInitializer] Modelos já registrados globalmente: ${existingModels.join(', ')}`);
    }
    
    // Garantir que a conexão está pronta para aceitar modelos
    if (mongoose.connection.readyState !== 1) {
      console.log('[MongoInitializer] Aguardando conexão antes de registrar modelos...');
      try {
        await (connectionPromise || initialize(CONNECTION_STRING));
      } catch (connError) {
        console.error('[MongoInitializer] Falha ao esperar conexão MongoDB:', connError);
        return false;
      }
    }
    
    // Carregar modelos essenciais diretamente
    const essentialModels = ['User', 'Subscription', 'Payment', 'Checkout', 'WebhookEvent'];
    for (const model of essentialModels) {
      try {
        // Verificar se o modelo já está registrado
        try {
          mongoose.model(model);
          console.log(`[MongoInitializer] Modelo ${model} já registrado`);
        } catch (notFound) {
          // Modelo não encontrado, carregar explicitamente
          try {
            require(path.join(__dirname, '..', 'models', model));
            console.log(`[MongoInitializer] Modelo ${model} registrado explicitamente`);
          } catch (e) {
            // Se não conseguir carregar do caminho exato, tentar procurar o arquivo
            const modelFiles = fs.readdirSync(path.join(__dirname, '..', 'models'))
              .filter(f => f.includes(model) && f.endsWith('.js'));
            
            if (modelFiles.length > 0) {
              require(path.join(__dirname, '..', 'models', modelFiles[0]));
              console.log(`[MongoInitializer] Modelo ${model} registrado pelo arquivo ${modelFiles[0]}`);
            } else {
              throw new Error(`Arquivo do modelo ${model} não encontrado`);
            }
          }
        }
      } catch (modelError) {
        console.error(`[MongoInitializer] Erro ao registrar modelo ${model}:`, modelError);
      }
    }
    
    // Verificar quais modelos estão disponíveis
    const registeredModels = mongoose.modelNames();
    console.log(`[MongoInitializer] Modelos registrados: ${registeredModels.join(', ')}`);
    
    // Verificar se os modelos essenciais foram registrados
    const missingModels = essentialModels.filter(m => !registeredModels.includes(m));
    if (missingModels.length > 0) {
      console.warn(`[MongoInitializer] Modelos essenciais ausentes: ${missingModels.join(', ')}`);
      return false;
    }
    
    modelsRegistered = true;
    return true;
  } catch (error) {
    console.error('[MongoInitializer] Erro ao registrar modelos:', error);
    return false;
  }
}

/**
 * Remove todos os listeners de eventos e fecha a conexão com o MongoDB
 * @returns {Promise} Promessa que resolve quando a conexão for fechada
 */
async function close() {
  if (!isInitialized) {
    return Promise.resolve();
  }
  
  try {
    // Parar verificador de conexão
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
    
    // Remover todos os listeners
    mongoose.connection.removeAllListeners();
    // Fechar conexão
    await mongoose.connection.close();
    console.log('[MongoInitializer] Conexão MongoDB fechada');
    // Resetar estado
    isInitialized = false;
    isConnected = false;
    modelsRegistered = false;
    connectionPromise = null;
    return true;
  } catch (error) {
    console.error('[MongoInitializer] Erro ao fechar conexão MongoDB:', error);
    return false;
  }
}

/**
 * Força o registro de um modelo específico
 * @param {string} modelName Nome do modelo para registrar
 * @returns {Promise<object>} Modelo registrado ou null se falhar
 */
async function forceRegisterModel(modelName) {
  try {
    // Primeiro, verificar se o modelo já está registrado globalmente
    try {
      const existingModel = mongoose.model(modelName);
      console.log(`[MongoInitializer] Modelo ${modelName} já registrado globalmente`);
      return existingModel;
    } catch (notRegistered) {
      // Modelo não encontrado, continuar com registro
    }
    
    // Garantir que a conexão está ativa
    if (mongoose.connection.readyState !== 1) {
      try {
        await waitForConnection();
      } catch (connError) {
        throw new Error(`Conexão não disponível: ${connError.message}`);
      }
    }
    
    // Tentar carregar o modelo explicitamente
    try {
      const modelPath = path.join(__dirname, '..', 'models', `${modelName}.js`);
      if (fs.existsSync(modelPath)) {
        const model = require(modelPath);
        console.log(`[MongoInitializer] Modelo ${modelName} registrado forçadamente`);
        return model;
      } else {
        // Se não encontrar com nome exato, procurar em todos os arquivos
        const modelFiles = fs.readdirSync(path.join(__dirname, '..', 'models'))
          .filter(f => f.toLowerCase().includes(modelName.toLowerCase()) && f.endsWith('.js'));
          
        if (modelFiles.length > 0) {
          const model = require(path.join(__dirname, '..', 'models', modelFiles[0]));
          console.log(`[MongoInitializer] Modelo ${modelName} registrado via arquivo ${modelFiles[0]}`);
          return model;
        } else {
          throw new Error(`Arquivo do modelo ${modelName} não encontrado`);
        }
      }
    } catch (loadError) {
      console.error(`[MongoInitializer] Erro ao forçar registro do modelo ${modelName}:`, loadError);
      return null;
    }
  } catch (error) {
    console.error(`[MongoInitializer] Erro geral ao forçar registro do modelo ${modelName}:`, error);
    return null;
  }
}

// Adicionar um mecanismo para sincronizar com a conexão global
async function syncWithGlobalConnection() {
  if (mongoose.connection.readyState === 1) {
    console.log('[MongoInitializer] Sincronizando estado com conexão global existente');
    isConnected = true;
    isInitialized = true;
    
    // MODIFICAÇÃO IMPORTANTE: Aguardar o registro de modelos de forma síncrona
    if (!modelsRegistered) {
      try {
        console.log('[MongoInitializer] Registrando modelos durante sincronização...');
        modelsRegistered = await registerModels();
        console.log(`[MongoInitializer] Resultado do registro de modelos durante sincronização: ${modelsRegistered ? 'SUCESSO' : 'FALHA'}`);
      } catch (error) {
        console.error('[MongoInitializer] Erro ao registrar modelos durante sincronização:', error);
        // Mesmo no caso de erro, vamos considerar que os modelos estão registrados se já existirem modelos
        modelsRegistered = mongoose.modelNames().length > 0;
        console.log(`[MongoInitializer] Após erro, definindo modelsRegistered=${modelsRegistered} com base nos modelos existentes`);
      }
    }
    
    return true;
  }
  return false;
}

// Executar sincronização durante o carregamento do módulo de forma síncrona
(async () => {
  try {
    await syncWithGlobalConnection();
    
    // Verificar status final
    console.log(`[MongoInitializer] Estado final após inicialização: isInitialized=${isInitialized}, isConnected=${isConnected}, modelsRegistered=${modelsRegistered}`);
    console.log(`[MongoInitializer] MongoDB está pronto? ${isReady() ? 'SIM' : 'NÃO'}`);
  } catch (error) {
    console.error('[MongoInitializer] Erro na inicialização:', error);
  }
})();

module.exports = {
  initialize,
  waitForConnection,
  registerModels,
  forceRegisterModel,
  isReady,
  close,
  syncWithGlobalConnection
}; 