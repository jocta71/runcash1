// Importações iniciais e configuração do Express
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Importar o inicializador do MongoDB
const mongoInitializer = require('./utils/mongoInitializer');

// Logs para monitorar o carregamento da aplicação
console.log("=== RunCash Server Iniciando ===");
console.log("Versão do Node:", process.version);
console.log("Ambiente:", process.env.NODE_ENV || 'development');

// Configurações
const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares
app.use(helmet()); // Segurança
app.use(cors()); // CORS
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON

// Adicionar middleware para salvar body bruto para webhooks
app.use((req, res, next) => {
  if (req.path.includes('/webhooks/')) {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      req.rawBody = data;
      next();
    });
  } else {
    next();
  }
});

// Rota inicial de diagnóstico (disponível imediatamente)
app.get('/', (req, res) => {
  res.json({
    name: 'RunCash API',
    version: '1.0.0',
    status: 'online'
  });
});

// Rota de emergência sempre disponível
app.post('/api/webhooks/asaas-test', (req, res) => {
  console.log("Webhook recebido (rota de emergência):", JSON.stringify(req.body, null, 2));
  return res.status(200).json({ 
    success: true, 
    message: 'Webhook recebido na rota de emergência',
    timestamp: new Date().toISOString()
  });
});

// Inicializar MongoDB antes de configurar as rotas
async function initializeServer() {
  try {
    // Inicializar conexão com o MongoDB - Agora usando uma abordagem global e consistente
    console.log("Inicializando conexão com MongoDB:", process.env.MONGODB_URI.replace(/:.*@/, ':****@'));
    
    try {
      // Conectar com Mongoose diretamente (conexão principal)
      await mongoose.connect(process.env.MONGODB_URI, { 
        dbName: process.env.MONGODB_DB_NAME,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        autoIndex: true,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
        maxPoolSize: 10
      });
      
      console.log("Conexão MongoDB estabelecida com sucesso via mongoose.connect()");
      console.log("Estado da conexão:", mongoose.connection.readyState);
      console.log("Banco de dados:", mongoose.connection.name);
      
      // Configurar tratadores de eventos para monitorar a conexão
      mongoose.connection.on('error', err => {
        console.error('Erro na conexão MongoDB:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.warn('Desconectado do MongoDB');
      });
      
      mongoose.connection.on('reconnected', () => {
        console.log('Reconectado ao MongoDB');
      });
      
      // Sincronizar o inicializador MongoDB com esta conexão global
      mongoInitializer.syncWithGlobalConnection();
      
    } catch (dbError) {
      console.error("Erro ao conectar ao MongoDB via mongoose direto:", dbError);
      console.log("Tentando conectar via mongoInitializer como fallback...");
      
      // Tentar via inicializador como fallback
      await mongoInitializer.initialize(process.env.MONGODB_URI, { 
        dbName: process.env.MONGODB_DB_NAME,
        autoIndex: true
      });
    }
    
    // Carregar modelos explicitamente no início
    console.log("[MODELS] Carregando modelos explicitamente no início");
    await loadModels();
    
    // Verificação explícita de modelos essenciais
    console.log("[MODELS] Verificando inicialização dos modelos...");
    const requiredModels = ['User', 'Subscription', 'Payment', 'Checkout', 'WebhookEvent'];
    
    // Verificar cada modelo
    for (const modelName of requiredModels) {
      try {
        mongoose.model(modelName);
        console.log(`[MODELS] Modelo ${modelName} já está registrado`);
      } catch (err) {
        console.error(`[MODELS] Modelo ${modelName} não está disponível:`, err.message);
        
        // Tentar registrar o modelo
        try {
          await mongoInitializer.forceRegisterModel(modelName);
          console.log(`[MODELS] Modelo ${modelName} registrado com sucesso`);
        } catch (regErr) {
          console.error(`[MODELS] Falha ao registrar modelo ${modelName}:`, regErr);
        }
      }
    }
    
    // Verificar novamente
    const availableModels = mongoose.modelNames();
    const missingModels = requiredModels.filter(m => !availableModels.includes(m));
    
    if (missingModels.length > 0) {
      console.warn(`[MODELS] Ainda existem modelos ausentes: ${missingModels.join(', ')}`);
    } else {
      console.log("[MODELS] Todos os modelos foram carregados com sucesso");
    }
    
    // Configurar rotas da API após a conexão ser estabelecida
    configureRoutes();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`=== RunCash Server Iniciado na porta ${PORT} ===`);
      console.log(`Webhook URL: ${process.env.PUBLIC_WEBHOOK_URL || 'não configurada'}`);
      console.log(`Status do MongoDB: ${mongoose.connection.readyState === 1 ? 'CONECTADO' : 'NÃO CONECTADO'}`);
      
      // Verificação final dos modelos
      const availableModels = mongoose.modelNames();
      console.log(`Modelos disponíveis (${availableModels.length}): ${availableModels.join(', ')}`);
    });
  } catch (error) {
    console.error("ERRO FATAL ao inicializar servidor:", error);
    process.exit(1);
  }
}

// Função para carregar explicitamente todos os modelos
async function loadModels() {
  try {
    console.log("[MODEL] Inicializando modelos...");
    
    // Listar arquivos no diretório models
    const modelsDir = path.join(__dirname, 'models');
    const modelFiles = fs.readdirSync(modelsDir)
      .filter(file => file.endsWith('.js'))
      .map(file => file.replace('.js', ''));
    
    // Carregar cada modelo explicitamente
    for (const modelName of modelFiles) {
      try {
        require(`./models/${modelName}`);
        console.log(`[MODEL] Modelo ${modelName} registrado`);
      } catch (err) {
        console.error(`[MODEL] Erro ao registrar modelo ${modelName}:`, err);
      }
    }
    
    // Carregar modelos essenciais explicitamente
    const essentialModels = ['User', 'Subscription', 'Payment', 'Checkout', 'WebhookEvent'];
    for (const modelName of essentialModels) {
      if (!modelFiles.includes(modelName) && !modelFiles.map(m => m.toLowerCase()).includes(modelName.toLowerCase())) {
        try {
          require(`./models/${modelName}`);
          console.log(`[MODEL] Modelo essencial ${modelName} registrado explicitamente`);
        } catch (err) {
          // Tentar encontrar o arquivo com nome aproximado
          const potentialFiles = fs.readdirSync(modelsDir)
            .filter(file => file.toLowerCase().includes(modelName.toLowerCase()) && file.endsWith('.js'));
          
          if (potentialFiles.length > 0) {
            try {
              require(`./models/${potentialFiles[0].replace('.js', '')}`);
              console.log(`[MODEL] Modelo ${modelName} registrado via arquivo aproximado ${potentialFiles[0]}`);
            } catch (innerErr) {
              console.error(`[MODEL] Erro ao registrar modelo ${modelName} (tentativa aproximada):`, innerErr);
            }
          } else {
            console.error(`[MODEL] Não foi possível encontrar arquivo para modelo ${modelName}`);
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("[MODEL] Erro ao carregar modelos:", error);
    return false;
  }
}

// Configurar rotas após conexão com MongoDB
function configureRoutes() {
  console.log("Configurando rotas da API...");
  
  // Configuração de rotas da API
  // Rotas de Assinatura
  const subscriptionRoutes = require('./api/subscription/routes');
  app.use('/api/subscription', subscriptionRoutes);

  // Rota de reconstrução de assinatura
  const subscriptionRebuildRoutes = require('./api/subscription/rebuild');
  app.use('/api/subscription', subscriptionRebuildRoutes);

  // Importar outras rotas
  const authRoutes = require('./api/auth');
  const userRoutes = require('./api/user');
  const checkoutRoutes = require('./api/checkout');

  // Rota para webhooks do Asaas - Com logs e tratamento de erro
  console.log("Tentando carregar rotas de webhook do Asaas...");
  try {
    // Verificar especificamente os modelos necessários para webhooks
    const webhookModels = ['Subscription', 'Payment', 'Checkout', 'WebhookEvent'];
    let allModelsAvailable = true;
    
    webhookModels.forEach(model => {
      try {
        const modelInstance = mongoose.model(model);
        console.log(`Modelo ${model} verificado e disponível para webhooks (coleção: ${modelInstance.collection.name})`);
      } catch (e) {
        allModelsAvailable = false;
        console.error(`ERRO: Modelo ${model} NÃO está disponível para webhooks:`, e.message);
      }
    });
    
    if (!allModelsAvailable) {
      console.error("ALERTA: Nem todos os modelos necessários para webhook estão disponíveis");
      console.log("Tentando registrar modelos novamente...");
      
      // Uso de uma IIFE async para permitir await dentro do if
      (async () => {
        try {
          await mongoInitializer.registerModels();
          
          // Verificar novamente após tentativa de registro
          let stillMissing = false;
          webhookModels.forEach(model => {
            try {
              mongoose.model(model);
              console.log(`Modelo ${model} agora está disponível`);
            } catch (e) {
              stillMissing = true;
              console.error(`Modelo ${model} continua indisponível após nova tentativa`);
            }
          });
          
          if (stillMissing) {
            console.error("FALHA: Alguns modelos ainda estão indisponíveis. Webhooks podem não funcionar corretamente.");
          }
        } catch (registerError) {
          console.error("Erro ao tentar registrar modelos novamente:", registerError);
        }
      })();
    }
    
    const asaasWebhookRoutes = require('./api/webhooks/asaas');
    app.use('/api/webhooks/asaas', asaasWebhookRoutes);
    console.log("Rotas de webhook do Asaas carregadas com sucesso");
  } catch (error) {
    console.error("ERRO ao carregar rotas de webhook:", error);
  }

  // Rota temporária para diagnóstico de webhooks
  app.get('/api/webhooks/asaas-test', (req, res) => {
    return res.status(200).json({ 
      success: true, 
      message: 'Endpoint de teste de webhook está funcionando',
      timestamp: new Date().toISOString(),
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'not connected',
      models: mongoose.modelNames()
    });
  });
  
  // Rota temporária para receber webhooks (debug)
  app.post('/api/webhooks/asaas-test', (req, res) => {
    console.log("Webhook recebido (rota de teste):", JSON.stringify(req.body, null, 2));
    return res.status(200).json({ 
      success: true, 
      message: 'Webhook recebido na rota de teste',
      timestamp: new Date().toISOString()
    });
  });

  // Configurar rotas
  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/checkout', checkoutRoutes);

  // Rota principal para verificar se o servidor está ativo (versão atualizada)
  app.get('/', (req, res) => {
    res.json({ 
      status: 'online', 
      service: 'RunCash Unified Server', 
      timestamp: new Date().toISOString(),
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      models: mongoose.modelNames().length
    });
  });

  // Diagnóstico de modelos disponível via API
  app.get('/api/diagnostics/models', async (req, res) => {
    try {
      const models = mongoose.modelNames();
      const modelDetails = [];
      
      for (const modelName of models) {
        try {
          const model = mongoose.model(modelName);
          let count = 0;
          
          // Tentar contar documentos, mas com timeout para evitar bloqueios
          try {
            count = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Timeout ao contar documentos'));
              }, 5000);
              
              model.countDocuments({})
                .then(result => {
                  clearTimeout(timeout);
                  resolve(result);
                })
                .catch(err => {
                  clearTimeout(timeout);
                  reject(err);
                });
            });
          } catch (countError) {
            console.warn(`Erro ao contar documentos para ${modelName}:`, countError.message);
          }
          
          modelDetails.push({
            name: modelName,
            collection: model.collection.name,
            status: 'connected',
            count: count
          });
        } catch (e) {
          modelDetails.push({
            name: modelName,
            status: 'error',
            error: e.message
          });
        }
      }
      
      res.json({
        status: 'success',
        timestamp: new Date().toISOString(),
        totalModels: models.length,
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        models: modelDetails
      });
    } catch (e) {
      res.status(500).json({
        status: 'error',
        error: e.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Endpoint para verificar status do MongoDB e forçar processamento da fila
  app.get('/api/diagnostics/mongodb', async (req, res) => {
    try {
      const mongoHelper = require('./utils/mongoHelper');
      const status = mongoHelper.getConnectionStatus();
      
      // Se solicitado, processar a fila offline
      let queueResult = null;
      if (req.query.processQueue === 'true') {
        try {
          queueResult = await mongoHelper.processOfflineQueue();
        } catch (queueError) {
          queueResult = { error: queueError.message };
        }
      }
      
      res.json({
        status: 'success',
        timestamp: new Date().toISOString(),
        mongodb: {
          status: status,
          connectionReady: mongoose.connection.readyState === 1,
          availableModels: mongoose.modelNames()
        },
        queueProcessed: queueResult
      });
    } catch (e) {
      res.status(500).json({
        status: 'error',
        error: e.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  console.log("Configuração de rotas concluída com sucesso");
}

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Erro interno no servidor',
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

// Iniciar o servidor
initializeServer().catch(error => {
  console.error("Falha ao iniciar o servidor:", error);
  process.exit(1);
}); 