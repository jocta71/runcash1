const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const path = require('path');
const process = require('process');

// Importar o inicializador do MongoDB para garantir conexão
const mongoInitializer = require('../../utils/mongoInitializer');

// Importar o auxiliar MongoDB para operações com retry
const mongoHelper = require('../../utils/mongoHelper');

// Importar buffer de webhooks
const webhookBuffer = require('../../utils/webhookBuffer');

// Inicialização avançada para garantir que todos os modelos estejam disponíveis
console.log('[WebhookAsaas] Inicializando webhook do Asaas com verificação de modelos...');

// Logger para diagnóstico
const logger = {
  info: (message, data = {}) => console.log(`[INFO] ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  warn: (message, data = {}) => console.warn(`[WARN] ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  error: (message, data = {}) => console.error(`[ERROR] ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data)
};

// Garantir que os modelos estão disponíveis para o processamento de webhooks
async function ensureModelsAvailable() {
  try {
    // Sincronizar com qualquer conexão Mongoose global existente
    mongoInitializer.syncWithGlobalConnection();
    
    console.log('[WebhookAsaas] Status da conexão MongoDB:', mongoose.connection.readyState === 1 ? 'connected' : 'disconnected');
    
    if (mongoose.connection.readyState !== 1) {
      console.log('[WebhookAsaas] Aguardando conexão MongoDB...');
      try {
        await mongoInitializer.waitForConnection(5000); // esperar até 5 segundos
      } catch (error) {
        console.warn('[WebhookAsaas] Timeout aguardando conexão MongoDB, continuando assim mesmo:', error.message);
      }
    }
    
    // Verificar se todos os modelos essenciais estão disponíveis
    const essentialModels = ['User', 'Subscription', 'Payment', 'Checkout', 'WebhookEvent'];
    const statusModels = {};
    let allAvailable = true;
    
    for (const modelName of essentialModels) {
      try {
        // Tentar obter o modelo
        try {
          mongoose.model(modelName);
          statusModels[modelName] = true;
        } catch (modelError) {
          // Tentar registrar o modelo diretamente
          const model = await mongoInitializer.forceRegisterModel(modelName);
          statusModels[modelName] = !!model;
          
          if (!model) {
            allAvailable = false;
            console.warn(`[WebhookAsaas] ❌ ALERTA: Modelo ${modelName} NÃO disponível!`);
          } else {
            console.log(`[WebhookAsaas] ✅ Modelo ${modelName} disponível via mongoInitializer`);
          }
        }
      } catch (error) {
        statusModels[modelName] = false;
        allAvailable = false;
        console.error(`[WebhookAsaas] Erro ao verificar modelo ${modelName}:`, error);
      }
    }
    
    // Relatório final
    console.log('[WebhookAsaas] Verificação final dos modelos:');
    for (const modelName of essentialModels) {
      console.log(`[WebhookAsaas] ${statusModels[modelName] ? '✅' : '❌ ALERTA:'} Modelo ${modelName} ${statusModels[modelName] ? 'disponível' : 'NÃO disponível!'}`);
    }
    
    return {
      allAvailable,
      availableModels: statusModels,
      missingModels: essentialModels.filter(m => !statusModels[m])
    };
  } catch (error) {
    console.error('[WebhookAsaas] Erro ao verificar disponibilidade dos modelos:', error);
    return {
      allAvailable: false,
      availableModels: {},
      missingModels: essentialModels,
      error: error.message
    };
  }
}

// Inicializar o middleware para verificar modelos
router.use(async (req, res, next) => {
  try {
    // Sincronizar com conexão global e verificar modelos
    mongoInitializer.syncWithGlobalConnection();
    
    // Log do status de conexão para diagnóstico
    const readyState = mongoose.connection.readyState;
    console.log(`[WebhookAsaas] Status da conexão MongoDB no middleware: ${readyState === 1 ? 'connected' : readyState === 2 ? 'connecting' : readyState === 0 ? 'disconnected' : 'unknown'}`);
    
    // Sem bloqueio - apenas verificar e continuar
    const status = await ensureModelsAvailable();
    console.log('[INFO] Verificação de modelos concluída:', status);
    
    // Mesmo se os modelos não estiverem disponíveis, continuar
    // O buffering tratará os webhooks para processamento posterior
    next();
  } catch (error) {
    console.error('[WebhookAsaas] Erro no middleware de verificação de modelos:', error);
    // Não bloquear a requisição, apenas logar o erro
    next();
  }
});

// Verificar estado da conexão
const connectionStatus = mongoHelper.getConnectionStatus();
console.log(`[WebhookAsaas] Status da conexão MongoDB: ${connectionStatus.status}`);

// Carregar modelos com sistema de retry e fallback
let User, Subscription, Payment, Checkout, WebhookEvent;

try {
  // Carregar modelos usando o helper
  User = mongoHelper.getModel('User');
  Subscription = mongoHelper.getModel('Subscription');
  Payment = mongoHelper.getModel('Payment');
  Checkout = mongoHelper.getModel('Checkout');
  WebhookEvent = mongoHelper.getModel('WebhookEvent');
  
  console.log('[WebhookAsaas] Todos os modelos carregados com sucesso via helper');
  
  // Verificar se todos os modelos estão disponíveis
  console.log('[WebhookAsaas] Verificação final dos modelos:');
  ['User', 'Subscription', 'Payment', 'Checkout', 'WebhookEvent'].forEach(model => {
    try {
      mongoose.model(model);
      console.log(`[WebhookAsaas] ✅ Modelo ${model} disponível`);
    } catch (e) {
      console.error(`[WebhookAsaas] ❌ ALERTA: Modelo ${model} NÃO disponível!`);
    }
  });
} catch (finalError) {
  console.error('[WebhookAsaas] Erro crítico na inicialização dos modelos:', finalError);
  
  // Implementar versões simplificadas para diagnóstico
  console.log('[WebhookAsaas] Usando implementações de diagnóstico para as coleções');
  
  // Definir modelos de diagnóstico que registram operações sem salvar no banco
  const createDiagnosticModel = (modelName) => ({
    findOne: async (query) => {
      logger.info(`[DiagnosticModel] Simulando findOne em ${modelName}`, { query });
      return null;
    },
    create: async (data) => {
      logger.info(`[DiagnosticModel] Simulando create em ${modelName}`, data);
      return { ...data, _id: `diag_${Date.now()}` };
    }
  });
  
  // Criar versões de diagnóstico para cada modelo
  User = createDiagnosticModel('User');
  Subscription = createDiagnosticModel('Subscription');
  Payment = createDiagnosticModel('Payment');
  Checkout = createDiagnosticModel('Checkout');
  WebhookEvent = createDiagnosticModel('WebhookEvent');
}

// Lista de eventos suportados
const SUPPORTED_EVENTS = [
  'CHECKOUT_PAID',
  'PAYMENT_CREATED',
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_RENEWED',
  'SUBSCRIPTION_PAYMENT_CONFIRMED'
];

/**
 * Middleware para capturar o corpo da requisição como texto bruto
 * antes do parsing do JSON. Útil para diagnóstico em caso de erros.
 */
router.use((req, res, next) => {
  // Garantir que os modelos estejam disponíveis para cada requisição
  ensureModelsAvailable()
    .then(() => {
      // Armazenar o conteúdo raw apenas se for POST
      if (req.method === 'POST') {
        // Verificar se o corpo já foi analisado
        if (req.body && Object.keys(req.body).length > 0) {
          // O corpo já foi analisado pelo express.json middleware
          // Apenas registrar alguns dados para diagnóstico
          console.log('[WebhookAsaas] Corpo já analisado pelo middleware express.json');
          next();
          return;
        }
        
        // Capturar dados brutos
        let rawData = '';
        const chunks = [];
        
        req.on('data', chunk => { 
          chunks.push(chunk);
          rawData += chunk; 
        });
        
        req.on('end', () => {
          // Salvar dados brutos para diagnóstico
          req.rawBody = rawData;
          
          // Tentar fazer o parse do JSON
          if (!req.body || Object.keys(req.body).length === 0) {
            try {
              req.body = JSON.parse(rawData);
              console.log('[WebhookAsaas] Parsing manual do JSON realizado com sucesso');
            } catch (jsonError) {
              console.error('[WebhookAsaas] Erro no parsing manual do JSON:', jsonError.message);
              // Criar um corpo vazio para evitar erros
              req.body = { _error: true, _rawData: rawData.substring(0, 500) };
            }
          }
          
          // Continuar para o próximo middleware/rota
          next();
        });
        
        req.on('error', (err) => {
          console.error('[WebhookAsaas] Erro ao ler dados da requisição:', err);
          req.rawBody = `[ERROR: ${err.message}]`;
          req.body = { _error: true, _errorMessage: err.message };
          next();
        });
      } else {
        // Não é POST, apenas passar para o próximo middleware
        next();
      }
    })
    .catch(modelError => {
      // Se houver erro na verificação de modelos, continuar mesmo assim
      logger.warn('Erro na verificação de modelos, continuando mesmo assim:', modelError);
      next();
    });
});

/**
 * Endpoint simplificado para receber webhooks do Asaas
 * Este endpoint registra todos os webhooks recebidos e responde com sucesso
 * enquanto tenta processar os eventos principais
 */
router.post('/', async (req, res) => {
  try {
    // Log inicial rápido
    console.log("===== WEBHOOK ASAAS RECEBIDO =====");
    
    // Capturar dados da requisição para processamento posterior
    const webhookData = {
      body: req.body || {},
      rawBody: req.rawBody,
      headers: req.headers,
      timestamp: new Date()
    };
    
    // Validação mais detalhada dos dados recebidos
    if (!webhookData.body || typeof webhookData.body !== 'object') {
      console.warn("Webhook recebido com dados inválidos: não é um objeto");
      return res.status(200).json({ 
        success: false, 
        message: 'Webhook recebido, mas o corpo não é um objeto JSON válido',
        timestamp: new Date().toISOString()
      });
    }
    
    // Verificar se é um evento suportado
    const event = webhookData.body.event;
    if (!event || typeof event !== 'string') {
      console.warn("Webhook recebido sem tipo de evento válido:", typeof event);
      return res.status(200).json({ 
        success: false, 
        message: 'Webhook recebido, mas sem tipo de evento válido',
        timestamp: new Date().toISOString()
      });
    }
    
    // Log detalhado do tipo de evento
    console.log(`Webhook Asaas: Evento ${event} recebido`);
    
    // Verificar se há dados específicos com base no tipo de evento
    if (event.includes('PAYMENT') && !webhookData.body.payment) {
      console.warn("Evento de pagamento sem dados de pagamento");
    } else if (event.includes('SUBSCRIPTION') && !webhookData.body.subscription) {
      console.warn("Evento de assinatura sem dados de assinatura");
    } else if (event.includes('CHECKOUT') && !webhookData.body.checkout) {
      console.warn("Evento de checkout sem dados de checkout");
    }
    
    // Sanitizar os dados para garantir que são serializáveis
    const sanitizedData = sanitizeWebhookData(webhookData.body);
    
    // Adicionar ao buffer para processamento posterior
    const bufferResult = webhookBuffer.addToBuffer('asaas', sanitizedData);
    console.log(`Webhook adicionado ao buffer: ${bufferResult.message}`);
    
    // RESPONDER IMEDIATAMENTE para evitar timeout
    res.status(200).json({ 
      success: true, 
      message: 'Webhook recebido com sucesso',
      event: event,
      buffered: !bufferResult.duplicate,
      timestamp: new Date().toISOString()
    });
    
    // Verificar se podemos processar agora ou deixar para processamento posterior
    const canProcessImmediately = mongoInitializer.isReady();
    
    if (!canProcessImmediately) {
      console.log("MongoDB não está pronto, webhook será processado quando a conexão estiver disponível");
      return; // Encerrar aqui, será processado posteriormente
    }
    
    // Tentar processar em segundo plano após enviar resposta
    process.nextTick(() => {
      try {
        // Se não for duplicado, tentar processar imediatamente
        if (!bufferResult.duplicate) {
          console.log("Processando webhook em segundo plano");
          
          // Verificar se temos dados válidos
          if (!event) {
            console.warn("Webhook recebido sem tipo de evento");
            return; // Encerrar processamento se não há evento
          }

          // Processamento assíncrono do evento
          processWebhookEvent(sanitizedData)
            .then(result => {
              console.log("Processamento do webhook concluído:", result);
              
              // Se processado com sucesso, marcar como processado no buffer
              if (result.success) {
                webhookBuffer.markAsProcessed(bufferResult.id);
              }
            })
            .catch(error => {
              console.error("Erro no processamento assíncrono do webhook:", error);
            });
        } else {
          console.log("Webhook duplicado, ignorando processamento imediato");
        }
      } catch (backgroundError) {
        console.error("Erro ao processar webhook em segundo plano:", backgroundError);
      }
    });
  } catch (error) {
    // Mesmo no caso de erro, tentar responder para evitar timeout
    console.error("ERRO CRÍTICO no handler do webhook:", error);
    
    // Tentar enviar uma resposta se ainda não enviou
    if (!res.headersSent) {
      return res.status(200).json({ 
        success: false, 
        message: 'Erro ao processar webhook, mas recebido',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

/**
 * Função para sanitizar dados do webhook e garantir que são serializáveis
 * Remove/converte valores problemáticos como NaN, Infinity, etc.
 */
function sanitizeWebhookData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  // Se for um array, sanitizar cada item
  if (Array.isArray(data)) {
    return data.map(item => sanitizeWebhookData(item));
  }
  
  // Para objetos, sanitizar cada propriedade
  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Tratar valores problemáticos
    if (value === null || value === undefined) {
      sanitized[key] = null;
    } else if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
      // Converter NaN e Infinity para null
      sanitized[key] = null;
    } else if (typeof value === 'object') {
      // Recursivamente sanitizar objetos e arrays
      sanitized[key] = sanitizeWebhookData(value);
    } else {
      // Manter outros valores primitivos
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Processa um evento de webhook de forma assíncrona
 * Esta função será executada depois que a resposta for enviada ao cliente
 */
async function processWebhookEvent(webhookData) {
  try {
    const event = webhookData.event;
    
    // Verificar se o evento já foi processado (idempotência)
    let eventId = '';
    try {
      // Gerar ID único baseado nos dados do evento
      if (webhookData.id) {
        eventId = webhookData.id;
      } else if (webhookData.payment?.id) {
        eventId = `${event}_${webhookData.payment.id}`;
      } else if (webhookData.subscription?.id) {
        eventId = `${event}_${webhookData.subscription.id}`;
      } else if (webhookData.checkout?.id) {
        eventId = `${event}_${webhookData.checkout.id}`;
      } else {
        // Fallback para casos sem ID específico
        const dataStr = JSON.stringify(webhookData);
        eventId = `${event}_${crypto.createHash('md5').update(dataStr).digest('hex')}`;
      }
      
      // Tentar registrar o evento se WebhookEvent estiver disponível
      if (WebhookEvent) {
        // Usar o helper para verificar se o evento já existe com retry
        const existingEvent = await mongoHelper.findOneWithRetry('WebhookEvent', { eventId });
        
        if (existingEvent) {
          console.log(`Evento já processado anteriormente: ${eventId}`);
          return { success: true, message: 'Evento já processado', status: 'DUPLICATE' };
        }
        
        // Registrar o evento como recebido com retry
        await mongoHelper.createWithRetry('WebhookEvent', {
          eventId,
          event,
          sourceId: webhookData.payment?.id || webhookData.subscription?.id || webhookData.checkout?.id,
          status: 'PROCESSING',
          payload: webhookData,
          createdAt: new Date()
        });
      }
    } catch (idempotencyError) {
      console.warn("Erro ao verificar idempotência:", idempotencyError);
      // Continuar com o processamento mesmo se falhar a verificação de idempotência
    }
    
    // Extrair customerId para uso nas funções de processamento
    const customerId = webhookData.payment?.customer || 
                       webhookData.subscription?.customer || 
                       webhookData.checkout?.customer;
    
    // Processar o evento de acordo com seu tipo
    let result;
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        console.log("Processando pagamento recebido:", webhookData.payment?.id);
        result = await processPaymentReceived(webhookData, customerId);
        break;
      case 'PAYMENT_CREATED':
        console.log("Processando pagamento criado:", webhookData.payment?.id);
        result = await processPaymentCreated(webhookData, customerId);
        break;
      case 'CHECKOUT_PAID':
        console.log("Processando checkout pago:", webhookData.checkout?.id);
        result = await processCheckoutPaid(webhookData, customerId);
        break;
      case 'SUBSCRIPTION_CREATED':
        console.log("Processando assinatura criada:", webhookData.subscription?.id);
        result = await processSubscriptionCreated(webhookData, customerId);
        break;
      case 'SUBSCRIPTION_UPDATED':
        console.log("Processando atualização de assinatura:", webhookData.subscription?.id);
        result = await processSubscriptionUpdate(webhookData, customerId);
        break;
      default:
        console.log("Evento não processado:", event);
        result = { success: true, message: 'Evento recebido, mas não processado (tipo não suportado)' };
    }
    
    // Atualizar o status do evento no banco se possível
    try {
      if (WebhookEvent && eventId) {
        await mongoHelper.updateWithRetry('WebhookEvent', 
          { eventId },
          { 
            $set: { 
              status: result.success ? 'PROCESSED' : 'FAILED',
              processingError: result.success ? null : result.message
            }
          }
        );
      }
    } catch (updateError) {
      console.warn("Erro ao atualizar status do evento:", updateError);
    }
    
    return result;
  } catch (error) {
    console.error("Erro ao processar evento:", error);
    return { success: false, message: `Erro ao processar evento: ${error.message}` };
  }
}

// Rota para testes simples
router.post('/test', (req, res) => {
  console.log("===== TESTE DE WEBHOOK ASAAS =====");
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Corpo:", JSON.stringify(req.body, null, 2));
  console.log("Dados brutos:", req.rawBody);

  res.status(200).json({
    success: true,
    message: "Teste de webhook recebido com sucesso",
    receivedAt: new Date().toISOString(),
    bodySize: req.rawBody ? req.rawBody.length : 0,
    contentType: req.headers['content-type'] || 'não especificado'
  });
});

/**
 * Rota para testar a liberação do serviço de roletas via pagamento recebido
 * Esta rota simula um pagamento recebido para o usuário especificado
 * @route POST /api/webhooks/asaas/test-payment-received
 * @access Apenas desenvolvimento
 */
router.post('/test-payment-received', async (req, res) => {
  try {
    // Verificar autorização simples para evitar testes acidentais em produção
    const authToken = req.headers['x-test-token'];
    if (!authToken || authToken !== 'dev-test-token') {
      return res.status(401).json({
        success: false,
        message: 'Token de teste inválido'
      });
    }
    
    // Extrair ID do usuário ou e-mail dos parâmetros
    const { userId, email, customerId } = req.body;
    
    if (!userId && !email && !customerId) {
      return res.status(400).json({
        success: false,
        message: 'É necessário fornecer userId, email ou customerId'
      });
    }
    
    // Encontrar usuário
    let user;
    if (userId) {
      user = await mongoHelper.findOneWithRetry('User', { _id: mongoose.Types.ObjectId(userId) });
    } else if (email) {
      user = await mongoHelper.findOneWithRetry('User', { email });
    } else if (customerId) {
      user = await mongoHelper.findOneWithRetry('User', { 'billingInfo.asaasId': customerId });
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar se o usuário tem customerId
    if (!user.billingInfo || !user.billingInfo.asaasId) {
      return res.status(400).json({
        success: false,
        message: 'Usuário não possui ID de cliente no Asaas'
      });
    }
    
    // Criar webhook simulado
    const mockWebhook = {
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: `test_payment_${Date.now()}`,
        customer: user.billingInfo.asaasId,
        value: 49.90,
        netValue: 48.0,
        status: 'RECEIVED',
        dueDate: new Date().toISOString().split('T')[0],
        billingType: 'CREDIT_CARD',
        invoiceUrl: 'https://www.example.com',
        description: 'Pagamento de teste para liberar roletas'
      }
    };
    
    // Processar o webhook simulado
    console.log(`===== SIMULANDO WEBHOOK PAYMENT_RECEIVED PARA USUÁRIO ${user._id} =====`);
    const result = await processPaymentReceived(mockWebhook, user.billingInfo.asaasId);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Simulação de webhook de pagamento processada com sucesso',
        result,
        user: {
          id: user._id,
          email: user.email,
          planStatus: 'ACTIVE' // Estado após processamento
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar simulação de webhook',
        error: result.message
      });
    }
  } catch (error) {
    console.error("Erro ao simular webhook de pagamento:", error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao simular webhook de pagamento',
      error: error.message
    });
  }
});

/**
 * Rota de diagnóstico para verificar o status do sistema de webhooks
 * Útil para monitoramento e troubleshooting
 */
router.get('/status', async (req, res) => {
  try {
    const result = {
      status: 'online',
      timestamp: new Date().toISOString(),
      models: {},
      buffer: webhookBuffer.getStats(),
      mongodb: mongoHelper.getConnectionStatus()
    };
    
    // Verificar modelos disponíveis
    const modelNames = ['User', 'Subscription', 'Payment', 'Checkout', 'WebhookEvent'];
    for (const modelName of modelNames) {
      try {
        let modelStatus = 'unavailable';
        let modelCount = 0;
        
        // Verificar modelo mongoose
        try {
          const model = mongoose.model(modelName);
          modelStatus = 'available';
          // Tentar contar registros
          try {
            modelCount = await model.countDocuments({});
            modelStatus = 'connected';
          } catch (countError) {
            console.warn(`Erro ao contar registros de ${modelName}:`, countError);
          }
        } catch (modelError) {
          console.warn(`Modelo ${modelName} não disponível:`, modelError.message);
        }
        
        result.models[modelName] = {
          status: modelStatus,
          count: modelCount
        };
      } catch (e) {
        result.models[modelName] = {
          status: 'error',
          error: e.message
        };
      }
    }
    
    // Verificar eventos recentes se WebhookEvent estiver disponível
    if (WebhookEvent && result.models.WebhookEvent.status === 'connected') {
      try {
        // Buscar eventos das últimas 24 horas
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        // Estatísticas de eventos por status
        const eventStats = await WebhookEvent.aggregate([
          { $match: { createdAt: { $gte: oneDayAgo } } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        // Eventos recentes
        const recentEvents = await WebhookEvent.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select('eventId event status createdAt');
        
        result.webhooks = {
          stats: eventStats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          }, {}),
          recentEvents: recentEvents.map(e => ({
            id: e.eventId,
            event: e.event,
            status: e.status,
            createdAt: e.createdAt
          }))
        };
      } catch (statsError) {
        result.webhooks = {
          error: statsError.message
        };
      }
    }
    
    return res.json(result);
  } catch (error) {
    console.error("Erro ao gerar status do webhook:", error);
    return res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Processa um evento de checkout pago
 */
async function processCheckoutPaid(webhook, customerId) {
  try {
    const checkoutData = webhook.checkout;
    
    if (!checkoutData || !checkoutData.id) {
      return { success: false, message: 'Dados do checkout não encontrados' };
    }
    
    // Encontrar o usuário pelo customerId do Asaas
    const user = await mongoHelper.findOneWithRetry('User', { 'billingInfo.asaasId': customerId });
    
    if (!user) {
      logger.warn(`Usuário não encontrado para o customerId: ${customerId}`);
      return { success: false, message: 'Usuário não encontrado' };
    }

    // Verificar se o checkout já existe
    let checkout = await mongoHelper.findOneWithRetry('Checkout', { checkoutId: checkoutData.id });
    
    if (checkout) {
      // Atualizar o checkout existente
      checkout.status = 'PAID';
      checkout.paidAt = new Date();
      
      // Se tiver payment ou subscription, atualizar
      if (checkoutData.payment && checkoutData.payment.id) {
        checkout.paymentId = checkoutData.payment.id;
      }
      
      if (checkoutData.subscription && checkoutData.subscription.id) {
        checkout.subscriptionId = checkoutData.subscription.id;
      }
      
      await mongoHelper.updateWithRetry('Checkout', 
        { _id: checkout._id },
        { $set: checkout }
      );
      
      logger.info(`Checkout ${checkoutData.id} atualizado como pago`);
    } else {
      // Criar novo registro de checkout
      checkout = await mongoHelper.createWithRetry('Checkout', {
        userId: user._id,
        checkoutId: checkoutData.id,
        paymentId: checkoutData.payment?.id,
        subscriptionId: checkoutData.subscription?.id,
        value: checkoutData.value,
        status: 'PAID',
        paidAt: new Date(),
        billingType: checkoutData.billingType || 'CREDIT_CARD',
        metadata: checkoutData
      });
      
      logger.info(`Novo checkout ${checkoutData.id} registrado`);
    }
    
    // Se tiver subscription, atualizar ou criar a assinatura
    if (checkoutData.subscription && checkoutData.subscription.id) {
      const subscriptionId = checkoutData.subscription.id;
      
      // Verificar se a assinatura já existe
      let subscription = await mongoHelper.findOneWithRetry('Subscription', { 
        userId: user._id, 
        asaasId: subscriptionId 
      });
      
      if (subscription) {
        // Atualizar a assinatura existente
        await mongoHelper.updateWithRetry('Subscription',
          { _id: subscription._id },
          { 
            $set: {
              status: 'ACTIVE',
              updatedAt: new Date()
            }
          }
        );
        
        logger.info(`Assinatura ${subscriptionId} atualizada para ACTIVE`);
      } else {
        // Criar nova assinatura
        subscription = await mongoHelper.createWithRetry('Subscription', {
          userId: user._id,
          asaasId: subscriptionId,
          planType: user.planType,
          status: 'ACTIVE',
          value: checkoutData.value,
          nextDueDate: checkoutData.subscription.nextDueDate,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // Atualizar o planType e planStatus do usuário
        await mongoHelper.updateWithRetry('User',
          { _id: user._id },
          { $set: { planStatus: 'ACTIVE' } }
        );
        
        logger.info(`Nova assinatura ${subscriptionId} criada`);
      }
    }
    
    return { success: true, message: 'Checkout processado com sucesso' };
  } catch (error) {
    logger.error('Erro ao processar CHECKOUT_PAID', { error: error.message, stack: error.stack });
    return { success: false, message: `Erro ao processar checkout: ${error.message}` };
  }
}

/**
 * Processa um evento de pagamento criado
 * Este evento é crucial para correlacionar pagamentos com checkouts
 */
async function processPaymentCreated(webhook, customerId) {
  try {
    const paymentData = webhook.payment;
    
    if (!paymentData || !paymentData.id) {
      return { success: false, message: 'Dados do pagamento não encontrados' };
    }
    
    // Encontrar o usuário pelo customerId do Asaas
    const user = await mongoHelper.findOneWithRetry('User', { 'billingInfo.asaasId': customerId });
    
    if (!user) {
      logger.warn(`Usuário não encontrado para o customerId: ${customerId}`);
      return { success: false, message: 'Usuário não encontrado' };
    }

    // Verificar se o pagamento já existe
    let payment = await mongoHelper.findOneWithRetry('Payment', { paymentId: paymentData.id });
    
    if (!payment) {
      // Registrar o novo pagamento
      payment = await mongoHelper.createWithRetry('Payment', {
        userId: user._id,
        paymentId: paymentData.id,
        value: paymentData.value,
        netValue: paymentData.netValue,
        status: paymentData.status,
        dueDate: paymentData.dueDate,
        billingType: paymentData.billingType,
        invoiceUrl: paymentData.invoiceUrl,
        subscriptionId: paymentData.subscription,
        metadata: paymentData
      });
      
      logger.info(`Novo pagamento ${paymentData.id} registrado`);
    } else {
      // Atualizar o pagamento existente
      await mongoHelper.updateWithRetry('Payment',
        { _id: payment._id },
        {
          $set: {
            status: paymentData.status,
            metadata: paymentData
          }
        }
      );
      
      logger.info(`Pagamento ${paymentData.id} atualizado`);
      return { success: true, message: 'Pagamento já registrado e atualizado' };
    }
    
    // Tentar associar este pagamento a um checkout recente
    // Buscar o checkout mais recente com o mesmo valor nos últimos 30 minutos
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const checkout = await mongoHelper.findWithRetry('Checkout', {
      userId: user._id,
      value: paymentData.value,
      createdAt: { $gte: thirtyMinutesAgo },
      paymentId: { $exists: false }, // Ainda não tem pagamento associado
      status: 'PENDING'
    }, { sort: { createdAt: -1 }, limit: 1 })[0]; // O mais recente primeiro
    
    if (checkout) {
      // Associar o pagamento ao checkout
      await mongoHelper.updateWithRetry('Checkout',
        { _id: checkout._id },
        { $set: { paymentId: paymentData.id } }
      );
      
      // Atualizar o pagamento com o ID do checkout
      await mongoHelper.updateWithRetry('Payment',
        { _id: payment._id },
        { $set: { checkoutId: checkout.checkoutId } }
      );
      
      logger.info(`Pagamento ${paymentData.id} associado ao checkout ${checkout.checkoutId}`);
      
      // Se o checkout tem ID de assinatura, atualizar o pagamento
      if (checkout.subscriptionId) {
        await mongoHelper.updateWithRetry('Payment',
          { _id: payment._id },
          { $set: { subscriptionId: checkout.subscriptionId } }
        );
        
        logger.info(`Pagamento ${paymentData.id} associado à assinatura ${checkout.subscriptionId}`);
      }
    } else {
      logger.info(`Não foi encontrado checkout pendente correspondente para o pagamento ${paymentData.id}`);
    }
    
    // Se o pagamento tem ID de assinatura, atualizar a assinatura
    if (paymentData.subscription) {
      const subscription = await mongoHelper.findOneWithRetry('Subscription', { 
        userId: user._id, 
        asaasId: paymentData.subscription 
      });
      
      if (subscription && paymentData.dueDate) {
        // Atualizar a data de próximo vencimento
        await mongoHelper.updateWithRetry('Subscription',
          { _id: subscription._id },
          { 
            $set: {
              nextDueDate: paymentData.dueDate,
              updatedAt: new Date()
            }
          }
        );
        
        logger.info(`Assinatura ${paymentData.subscription} atualizada com nova data de vencimento`);
      }
    }
    
    return { success: true, message: 'Pagamento processado com sucesso' };
  } catch (error) {
    logger.error('Erro ao processar PAYMENT_CREATED', { error: error.message, stack: error.stack });
    return { success: false, message: `Erro ao processar pagamento: ${error.message}` };
  }
}

/**
 * Processa um evento de pagamento recebido ou confirmado
 */
async function processPaymentReceived(webhook, customerId) {
  try {
    const paymentData = webhook.payment;
    
    if (!paymentData || !paymentData.id) {
      return { success: false, message: 'Dados do pagamento não encontrados' };
    }
    
    // Encontrar o usuário pelo customerId do Asaas
    const user = await mongoHelper.findOneWithRetry('User', { 'billingInfo.asaasId': customerId });
    
    if (!user) {
      logger.warn(`Usuário não encontrado para o customerId: ${customerId}`);
      return { success: false, message: 'Usuário não encontrado' };
    }

    // Verificar se o pagamento já existe
    let payment = await mongoHelper.findOneWithRetry('Payment', { paymentId: paymentData.id });
    
    if (payment) {
      // Atualizar o pagamento existente
      await mongoHelper.updateWithRetry('Payment',
        { _id: payment._id },
        {
          $set: {
            status: 'RECEIVED',
            confirmedDate: new Date(),
            metadata: paymentData
          }
        }
      );
      
      logger.info(`Pagamento ${paymentData.id} atualizado como recebido`);
      
      // Se o pagamento estiver vinculado a um checkout, atualizar o checkout
      if (payment.checkoutId) {
        const checkout = await mongoHelper.findOneWithRetry('Checkout', { checkoutId: payment.checkoutId });
        
        if (checkout) {
          await mongoHelper.updateWithRetry('Checkout',
            { _id: checkout._id },
            {
              $set: {
                status: 'PAID',
                paidAt: new Date()
              }
            }
          );
          
          logger.info(`Checkout ${payment.checkoutId} atualizado como pago`);
        }
      }
      
      // Se o pagamento estiver vinculado a uma assinatura, atualizar a assinatura
      if (payment.subscriptionId) {
        const subscription = await mongoHelper.findOneWithRetry('Subscription', { 
          userId: user._id, 
          asaasId: payment.subscriptionId 
        });
        
        if (subscription) {
          await mongoHelper.updateWithRetry('Subscription',
            { _id: subscription._id },
            {
              $set: {
                status: 'ACTIVE',
                updatedAt: new Date()
              }
            }
          );
          
          // Atualizar o planStatus do usuário
          await mongoHelper.updateWithRetry('User',
            { _id: user._id },
            { $set: { planStatus: 'ACTIVE' } }
          );
          
          logger.info(`Assinatura ${payment.subscriptionId} atualizada para ACTIVE - Serviço de roletas liberado para o usuário`);
        }
      } else {
        // Mesmo sem assinatura, ativar o acesso temporário às roletas para o usuário
        // Essa é uma melhoria para garantir que pagamentos únicos também liberem acesso
        await mongoHelper.updateWithRetry('User',
          { _id: user._id },
          { $set: { planStatus: 'ACTIVE' } }
        );
        
        // Criar ou atualizar uma entrada na coleção subscriptions para permitir acesso
        // Isso garante que o middleware de assinatura permita acesso aos recursos
        const existingSubscription = await mongoHelper.findOneWithRetry('subscriptions', {
          user_id: user._id.toString()
        });
        
        if (existingSubscription) {
          await mongoHelper.updateWithRetry('subscriptions',
            { _id: existingSubscription._id },
            {
              $set: {
                status: 'active',
                plan_id: user.planType || 'BASIC',
                updatedAt: new Date()
              }
            }
          );
        } else {
          // Criar novo registro na collection subscriptions (usada pelo middleware)
          await mongoHelper.createWithRetry('subscriptions', {
            user_id: user._id.toString(),
            status: 'active',
            plan_id: user.planType || 'BASIC',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        
        logger.info(`Acesso ao serviço de roletas liberado para o usuário ${user._id} após pagamento recebido`);
      }
    } else {
      // Criar novo registro de pagamento
      payment = await mongoHelper.createWithRetry('Payment', {
        userId: user._id,
        paymentId: paymentData.id,
        value: paymentData.value,
        netValue: paymentData.netValue,
        status: 'RECEIVED',
        confirmedDate: new Date(),
        dueDate: paymentData.dueDate,
        billingType: paymentData.billingType,
        invoiceUrl: paymentData.invoiceUrl,
        subscriptionId: paymentData.subscription,
        metadata: paymentData
      });
      
      logger.info(`Novo pagamento ${paymentData.id} registrado como recebido`);
      
      // Se o pagamento tem ID de assinatura, atualizar a assinatura
      if (paymentData.subscription) {
        const subscription = await mongoHelper.findOneWithRetry('Subscription', { 
          userId: user._id, 
          asaasId: paymentData.subscription 
        });
        
        if (subscription) {
          await mongoHelper.updateWithRetry('Subscription',
            { _id: subscription._id },
            {
              $set: {
                status: 'ACTIVE',
                updatedAt: new Date()
              }
            }
          );
          
          // Atualizar o planStatus do usuário
          await mongoHelper.updateWithRetry('User',
            { _id: user._id },
            { $set: { planStatus: 'ACTIVE' } }
          );
          
          logger.info(`Assinatura ${paymentData.subscription} atualizada para ACTIVE - Serviço de roletas liberado para o usuário`);
        }
      } else {
        // Mesmo sem assinatura, ativar o acesso temporário às roletas para o usuário
        await mongoHelper.updateWithRetry('User',
          { _id: user._id },
          { $set: { planStatus: 'ACTIVE' } }
        );
        
        // Criar ou atualizar uma entrada na coleção subscriptions para permitir acesso
        // Isso garante que o middleware de assinatura permita acesso aos recursos
        const existingSubscription = await mongoHelper.findOneWithRetry('subscriptions', {
          user_id: user._id.toString()
        });
        
        if (existingSubscription) {
          await mongoHelper.updateWithRetry('subscriptions',
            { _id: existingSubscription._id },
            {
              $set: {
                status: 'active',
                plan_id: user.planType || 'BASIC',
                updatedAt: new Date()
              }
            }
          );
        } else {
          // Criar novo registro na collection subscriptions (usada pelo middleware)
          await mongoHelper.createWithRetry('subscriptions', {
            user_id: user._id.toString(),
            status: 'active',
            plan_id: user.planType || 'BASIC',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        
        logger.info(`Acesso ao serviço de roletas liberado para o usuário ${user._id} após pagamento recebido`);
      }
    }
    
    return { success: true, message: 'Pagamento recebido processado com sucesso, serviço de roletas liberado' };
  } catch (error) {
    logger.error('Erro ao processar PAYMENT_RECEIVED', { error: error.message, stack: error.stack });
    return { success: false, message: `Erro ao processar pagamento recebido: ${error.message}` };
  }
}

/**
 * Processa um evento de assinatura criada
 */
async function processSubscriptionCreated(webhook, customerId) {
  try {
    const subscriptionData = webhook.subscription;
    
    if (!subscriptionData || !subscriptionData.id) {
      return { success: false, message: 'Dados da assinatura não encontrados' };
    }
    
    // Encontrar o usuário pelo customerId do Asaas
    const user = await mongoHelper.findOneWithRetry('User', { 'billingInfo.asaasId': customerId });
    
    if (!user) {
      logger.warn(`Usuário não encontrado para o customerId: ${customerId}`);
      return { success: false, message: 'Usuário não encontrado' };
    }

    // Verificar se a assinatura já existe
    let subscription = await mongoHelper.findOneWithRetry('Subscription', { 
      userId: user._id, 
      asaasId: subscriptionData.id 
    });
    
    if (subscription) {
      // Atualizar a assinatura existente
      await mongoHelper.updateWithRetry('Subscription',
        { _id: subscription._id },
        {
          $set: {
            status: subscriptionData.status,
            value: subscriptionData.value,
            nextDueDate: subscriptionData.nextDueDate,
            updatedAt: new Date()
          }
        }
      );
      
      logger.info(`Assinatura ${subscriptionData.id} atualizada`);
    } else {
      // Criar nova assinatura
      subscription = await mongoHelper.createWithRetry('Subscription', {
        userId: user._id,
        asaasId: subscriptionData.id,
        planType: user.planType,
        status: subscriptionData.status,
        value: subscriptionData.value,
        nextDueDate: subscriptionData.nextDueDate,
        cycle: subscriptionData.cycle,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      logger.info(`Nova assinatura ${subscriptionData.id} criada`);
    }
    
    // Atualizar o planStatus do usuário se a assinatura estiver ativa
    if (subscriptionData.status === 'ACTIVE') {
      await mongoHelper.updateWithRetry('User',
        { _id: user._id },
        { $set: { planStatus: 'ACTIVE' } }
      );
      
      logger.info(`Status do plano do usuário ${user._id} atualizado para ACTIVE`);
    }
    
    return { success: true, message: 'Assinatura criada processada com sucesso' };
  } catch (error) {
    logger.error('Erro ao processar SUBSCRIPTION_CREATED', { error: error.message, stack: error.stack });
    return { success: false, message: `Erro ao processar assinatura criada: ${error.message}` };
  }
}

/**
 * Processa um evento de atualização de assinatura
 */
async function processSubscriptionUpdate(webhook, customerId) {
  try {
    const subscriptionData = webhook.subscription;
    
    if (!subscriptionData || !subscriptionData.id) {
      return { success: false, message: 'Dados da assinatura não encontrados' };
    }
    
    // Encontrar o usuário pelo customerId do Asaas
    const user = await mongoHelper.findOneWithRetry('User', { 'billingInfo.asaasId': customerId });
    
    if (!user) {
      logger.warn(`Usuário não encontrado para o customerId: ${customerId}`);
      return { success: false, message: 'Usuário não encontrado' };
    }

    // Encontrar a assinatura
    const subscription = await mongoHelper.findOneWithRetry('Subscription', { 
      userId: user._id, 
      asaasId: subscriptionData.id 
    });
    
    if (!subscription) {
      logger.warn(`Assinatura ${subscriptionData.id} não encontrada para o usuário ${user._id}`);
      
      // Criar a assinatura se não existir (para recuperar de inconsistências)
      await mongoHelper.createWithRetry('Subscription', {
        userId: user._id,
        asaasId: subscriptionData.id,
        planType: user.planType,
        status: subscriptionData.status,
        value: subscriptionData.value,
        nextDueDate: subscriptionData.nextDueDate,
        cycle: subscriptionData.cycle,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      logger.info(`Nova assinatura ${subscriptionData.id} criada durante atualização`);
    } else {
      // Atualizar a assinatura existente
      await mongoHelper.updateWithRetry('Subscription',
        { _id: subscription._id },
        {
          $set: {
            status: subscriptionData.status,
            value: subscriptionData.value,
            nextDueDate: subscriptionData.nextDueDate,
            updatedAt: new Date()
          }
        }
      );
      
      logger.info(`Assinatura ${subscriptionData.id} atualizada`);
    }
    
    // Atualizar o planStatus do usuário com base no status da assinatura
    if (subscriptionData.status === 'ACTIVE') {
      await mongoHelper.updateWithRetry('User',
        { _id: user._id },
        { $set: { planStatus: 'ACTIVE' } }
      );
      
      logger.info(`Status do plano do usuário ${user._id} atualizado para ACTIVE`);
    } else if (subscriptionData.status === 'INACTIVE' || subscriptionData.status === 'OVERDUE') {
      await mongoHelper.updateWithRetry('User',
        { _id: user._id },
        { $set: { planStatus: 'INACTIVE' } }
      );
      
      logger.info(`Status do plano do usuário ${user._id} atualizado para INACTIVE`);
    }
    
    return { success: true, message: 'Atualização de assinatura processada com sucesso' };
  } catch (error) {
    logger.error('Erro ao processar atualização de assinatura', { error: error.message, stack: error.stack });
    return { success: false, message: `Erro ao processar atualização de assinatura: ${error.message}` };
  }
}

// Adicionar rota para processar o buffer de webhooks manualmente
router.get('/process-buffer', async (req, res) => {
  // Verificar estado da conexão antes de processar
  if (!mongoInitializer.isReady()) {
    return res.json({
      success: false,
      message: 'MongoDB não está pronto para processar webhooks',
      connectionStatus: mongoHelper.getConnectionStatus()
    });
  }
  
  // Iniciar processamento do buffer
  console.log("Iniciando processamento do buffer de webhooks...");
  
  try {
    const result = await webhookBuffer.processBuffer(processWebhookEvent);
    
    return res.json({
      success: true,
      message: 'Processamento do buffer iniciado',
      result
    });
  } catch (error) {
    console.error("Erro ao processar buffer de webhooks:", error);
    
    return res.json({
      success: false,
      message: 'Erro ao processar buffer de webhooks',
      error: error.message
    });
  }
});

// Iniciar o processamento automático do buffer
// Verificar a cada 30 segundos se há webhooks para processar
const BUFFER_CHECK_INTERVAL = 30 * 1000; // 30 segundos
let bufferProcessorInterval = null;

function startBufferProcessor() {
  // Limpar intervalo anterior se existir
  if (bufferProcessorInterval) {
    clearInterval(bufferProcessorInterval);
  }
  
  // Configurar verificação periódica
  bufferProcessorInterval = setInterval(async () => {
    try {
      // Verificar se o MongoDB está pronto antes de processar
      if (!mongoInitializer.isReady()) {
        console.log("[WebhookBuffer] MongoDB não está pronto, verificando novamente mais tarde");
        return;
      }
      
      // Verificar se há webhooks para processar
      const stats = webhookBuffer.getStats();
      if (stats.bufferSize === 0) {
        // Nada para processar
        return;
      }
      
      console.log(`[WebhookBuffer] Processamento automático de ${stats.bufferSize} webhooks...`);
      
      // Processar buffer
      const result = await webhookBuffer.processBuffer(processWebhookEvent);
      console.log(`[WebhookBuffer] Processamento automático concluído: ${result.results?.processed || 0} de ${result.results?.total || 0} processados`);
    } catch (error) {
      console.error("[WebhookBuffer] Erro no processamento automático:", error);
    }
  }, BUFFER_CHECK_INTERVAL);
  
  console.log(`[WebhookBuffer] Processador automático iniciado (intervalo: ${BUFFER_CHECK_INTERVAL / 1000}s)`);
}

// Verificar conexão do MongoDB para iniciar o processador
mongoose.connection.on('connected', () => {
  console.log("[WebhookBuffer] MongoDB conectado, iniciando processador de buffer");
  startBufferProcessor();
});

// Iniciar processador ao carregar o módulo se conexão já estiver ativa
if (mongoose.connection.readyState === 1) {
  console.log("[WebhookBuffer] MongoDB já conectado, iniciando processador de buffer");
  startBufferProcessor();
}

module.exports = router; 