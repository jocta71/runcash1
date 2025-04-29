const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { corsMiddleware } = require('./utils/corsConfig');
const logger = require('./utils/logger');
const security = require('./utils/security');
const storage = require('./utils/storage');

// Configurações do servidor
const CONFIG = {
  port: process.env.WEBHOOK_PORT || 3030,
  host: process.env.WEBHOOK_HOST || 'localhost',
  routes: {
    webhook: '/api/asaas-webhook',
    debug: '/debug',
    health: '/health'
  },
  security: {
    validateIP: process.env.VALIDATE_IP === 'true',
    validateToken: process.env.VALIDATE_TOKEN !== 'false',
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN || 'seu-token-aqui',
    allowedIPs: (process.env.ALLOWED_IPS || '').split(',').filter(ip => ip.trim().length > 0),
  },
  server: {
    maxStoredEvents: 100,
    eventExpiryTime: 7 * 24 * 60 * 60 * 1000, // 7 dias em milissegundos
    cleanupInterval: 60 * 60 * 1000 // 1 hora em milissegundos
  },
  frontend: {
    url: process.env.FRONTEND_URL || 'https://runcashh11.vercel.app'
  }
};

// Inicializa o app Express
const app = express();

// Configurar middlewares
app.use(bodyParser.json());
app.use(corsMiddleware()); // Usar o middleware CORS personalizado

// Função para limpar eventos antigos
function cleanupOldEvents() {
  const now = Date.now();
  const cutoffTime = now - CONFIG.server.eventExpiryTime;
  
  const initialCount = storage.storage.webhookEvents.length;
  storage.storage.webhookEvents = storage.storage.webhookEvents.filter(event => 
    event.receivedAt && event.receivedAt > cutoffTime
  );
  
  if (initialCount !== storage.storage.webhookEvents.length) {
    logger.debug(`Limpeza de eventos: ${initialCount - storage.storage.webhookEvents.length} eventos removidos, ${storage.storage.webhookEvents.length} mantidos`);
  }
}

// Agenda a limpeza periódica
setInterval(cleanupOldEvents, CONFIG.server.cleanupInterval);

// Carrega dados salvos anteriormente
storage.loadPersistedData();

// Função para registrar um evento recebido
function recordWebhookEvent(event) {
  const eventWithTimestamp = {
    ...event,
    receivedAt: Date.now()
  };
  
  // Adiciona ao início do array para ter os mais recentes primeiro
  storage.storage.webhookEvents.unshift(eventWithTimestamp);
  
  // Limita o tamanho máximo
  if (storage.storage.webhookEvents.length > CONFIG.server.maxStoredEvents) {
    storage.storage.webhookEvents.pop();
  }
  
  logger.debug('Evento registrado', { eventId: event.id, eventType: event.event });
  return eventWithTimestamp;
}

// Funções para atualizar caches
function updateSubscriptionCache(subscription) {
  if (!subscription || !subscription.id) {
    logger.warn('Tentativa de atualizar assinatura sem ID válido');
    return null;
  }
  
  // Obtém a assinatura atual ou cria uma nova
  const currentSubscription = storage.storage.subscriptions[subscription.id] || {};
  
  // Atualiza com novos dados
  storage.storage.subscriptions[subscription.id] = {
    ...currentSubscription,
    ...subscription,
    updatedAt: Date.now()
  };
  
  logger.info(`Assinatura atualizada: ${subscription.id}`, { 
    status: subscription.status, 
    customerId: subscription.customer 
  });
  
  return storage.storage.subscriptions[subscription.id];
}

function updatePaymentCache(payment) {
  if (!payment || !payment.id) {
    logger.warn('Tentativa de atualizar pagamento sem ID válido');
    return null;
  }
  
  // Obtém o pagamento atual ou cria um novo
  const currentPayment = storage.storage.payments[payment.id] || {};
  
  // Atualiza com novos dados
  storage.storage.payments[payment.id] = {
    ...currentPayment,
    ...payment,
    updatedAt: Date.now()
  };
  
  logger.info(`Pagamento atualizado: ${payment.id}`, { 
    status: payment.status, 
    value: payment.value,
    dueDate: payment.dueDate
  });
  
  return storage.storage.payments[payment.id];
}

// Handlers para diferentes tipos de eventos
function handlePaymentConfirmed(event) {
  const payment = event.payment;
  if (!payment) {
    logger.warn('Evento de pagamento confirmado sem dados de pagamento', { eventId: event.id });
    return;
  }
  
  const updatedPayment = storage.updatePaymentCache({
    ...payment,
    status: 'CONFIRMED'
  });
  
  // Se o pagamento estiver associado a uma assinatura, atualiza-a também
  if (payment.subscription) {
    logger.info(`Pagamento associado à assinatura ${payment.subscription}`);
    
    // Obtém a assinatura atual, se existir
    const subscription = storage.storage.subscriptions[payment.subscription];
    if (subscription) {
      storage.updateSubscriptionCache({
        ...subscription,
        lastPayment: {
          id: payment.id,
          status: 'CONFIRMED',
          value: payment.value,
          confirmedDate: payment.paymentDate
        }
      });
    }
  }
  
  return updatedPayment;
}

function handlePaymentOverdue(event) {
  const payment = event.payment;
  if (!payment) {
    logger.warn('Evento de pagamento atrasado sem dados de pagamento', { eventId: event.id });
    return;
  }
  
  const updatedPayment = storage.updatePaymentCache({
    ...payment,
    status: 'OVERDUE'
  });
  
  // Se o pagamento estiver associado a uma assinatura, atualiza-a também
  if (payment.subscription) {
    logger.info(`Pagamento em atraso associado à assinatura ${payment.subscription}`);
    
    // Obtém a assinatura atual, se existir
    const subscription = storage.storage.subscriptions[payment.subscription];
    if (subscription) {
      storage.updateSubscriptionCache({
        ...subscription,
        lastPayment: {
          id: payment.id,
          status: 'OVERDUE',
          value: payment.value,
          dueDate: payment.dueDate
        }
      });
    }
  }
  
  return updatedPayment;
}

function handleSubscriptionCreated(event) {
  const subscription = event.subscription;
  if (!subscription) {
    logger.warn('Evento de assinatura criada sem dados de assinatura', { eventId: event.id });
    return;
  }
  
  return storage.updateSubscriptionCache(subscription);
}

function handleSubscriptionUpdated(event) {
  const subscription = event.subscription;
  if (!subscription) {
    logger.warn('Evento de assinatura atualizada sem dados de assinatura', { eventId: event.id });
    return;
  }
  
  return storage.updateSubscriptionCache(subscription);
}

function handleSubscriptionCancelled(event) {
  const subscription = event.subscription;
  if (!subscription) {
    logger.warn('Evento de assinatura cancelada sem dados de assinatura', { eventId: event.id });
    return;
  }
  
  return storage.updateSubscriptionCache({
    ...subscription,
    status: 'CANCELLED',
    cancelledDate: new Date().toISOString()
  });
}

// Middleware para validação de segurança
app.use(CONFIG.routes.webhook, security.createSecurityMiddleware({
  validateIP: CONFIG.security.validateIP,
  validateToken: CONFIG.security.validateToken,
  allowedIPs: CONFIG.security.allowedIPs,
  webhookToken: CONFIG.security.webhookToken
}));

// Middleware para logging de requisições
app.use((req, res, next) => {
  const start = Date.now();
  
  // Intercepta o método end para capturar o status da resposta
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - start;
    
    logger.info(`${req.method} ${req.originalUrl || req.url}`, {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.connection.remoteAddress,
      status: res.statusCode,
      responseTime: `${responseTime}ms`
    });
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
});

// Configurações especiais para rotas de preflight OPTIONS
app.options('*', cors(corsOptions));

// Rota principal para receber webhooks
app.post(CONFIG.routes.webhook, async (req, res) => {
  try {
    const webhookEvent = req.body;
    
    if (!webhookEvent || !webhookEvent.event) {
      logger.warn('Webhook recebido sem tipo de evento', { body: req.body });
      return res.status(400).json({ error: 'Dados do evento inválidos' });
    }
    
    logger.info(`Webhook recebido: ${webhookEvent.event}`, { 
      eventId: webhookEvent.id,
      event: webhookEvent.event
    });
    
    // Implementação de idempotência - verificar se este evento já foi processado
    // Verificar se o webhook já foi processado (idempotência)
    const eventId = webhookEvent.id;
    const eventExists = storage.storage.webhookEvents.some(event => 
      event.id === eventId
    );

    if (eventExists) {
      logger.info(`Webhook já processado anteriormente (idempotência): ${eventId}`);
      return res.status(200).json({ status: 'success', idempotent: true });
    }
    
    // Registra o evento ANTES de qualquer processamento
    storage.recordWebhookEvent(webhookEvent);
    
    // Responder rapidamente para evitar timeout (10s) do Asaas
    // Vamos enviar a resposta ANTES de processar completamente o evento
    res.status(200).json({ status: 'success', received: true });
    
    // Continue processando o evento APÓS enviar a resposta
    // Neste ponto, o Asaas já recebeu a resposta e considera o webhook entregue
    
    // Processamento com base no tipo de evento
    try {
      switch (webhookEvent.event) {
        case 'PAYMENT_CONFIRMED':
          handlePaymentConfirmed(webhookEvent);
          break;
        case 'PAYMENT_RECEIVED':
          handlePaymentConfirmed(webhookEvent); // Trata da mesma forma que confirmado
          break;
        case 'PAYMENT_OVERDUE':
          handlePaymentOverdue(webhookEvent);
          break;
        case 'PAYMENT_DELETED':
        case 'PAYMENT_REFUNDED':
        case 'PAYMENT_REFUND_FAILED':
          storage.updatePaymentCache({
            ...webhookEvent.payment,
            status: webhookEvent.event.replace('PAYMENT_', '')
          });
          break;
        case 'SUBSCRIPTION_CREATED':
          handleSubscriptionCreated(webhookEvent);
          break;
        case 'SUBSCRIPTION_UPDATED':
          handleSubscriptionUpdated(webhookEvent);
          break;
        case 'SUBSCRIPTION_CANCELLED':
          handleSubscriptionCancelled(webhookEvent);
          break;
        case 'SUBSCRIPTION_EXPIRED':
          storage.updateSubscriptionCache({
            ...webhookEvent.subscription,
            status: 'EXPIRED'
          });
          break;
        default:
          logger.info(`Evento não processado: ${webhookEvent.event}`, { eventId: webhookEvent.id });
      }
    } catch (processingError) {
      // Isso não afeta a resposta ao Asaas, pois já respondemos
      logger.errorWithStack('Erro durante o processamento assíncrono do webhook', processingError);
      // Aqui poderíamos implementar uma fila de retry para eventos com falha
    }
    
  } catch (error) {
    logger.errorWithStack('Erro ao processar webhook', error);
    // Só envia a resposta de erro se ainda não enviamos uma resposta
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno ao processar webhook' });
    }
  }
});

// Rotas para consulta dos dados

// Lista eventos recebidos
app.get(`${CONFIG.routes.debug}/events`, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const events = storage.storage.webhookEvents.slice(0, limit);
    res.json({ events });
  } catch (error) {
    logger.errorWithStack('Erro ao listar eventos', error);
    res.status(500).json({ error: 'Erro interno ao listar eventos' });
  }
});

// Verifica status de uma assinatura
app.get(`${CONFIG.routes.debug}/subscription/:id`, (req, res) => {
  try {
    const subscriptionId = req.params.id;
    const subscription = storage.storage.subscriptions[subscriptionId];
    
    if (!subscription) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }
    
    res.json({ subscription });
  } catch (error) {
    logger.errorWithStack('Erro ao buscar assinatura', error);
    res.status(500).json({ error: 'Erro interno ao buscar assinatura' });
  }
});

// Verifica status de um pagamento
app.get(`${CONFIG.routes.debug}/payment/:id`, (req, res) => {
  try {
    const paymentId = req.params.id;
    const payment = storage.storage.payments[paymentId];
    
    if (!payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    
    res.json({ payment });
  } catch (error) {
    logger.errorWithStack('Erro ao buscar pagamento', error);
    res.status(500).json({ error: 'Erro interno ao buscar pagamento' });
  }
});

// Lista assinaturas de um usuário
app.get(`${CONFIG.routes.debug}/customer/:id/subscriptions`, (req, res) => {
  try {
    const customerId = req.params.id;
    const customer = storage.storage.customers[customerId];
    
    if (!customer) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    const subscriptions = customer.subscriptions
      ? customer.subscriptions.map(subId => storage.storage.subscriptions[subId]).filter(Boolean)
      : [];
    
    res.json({ 
      customer: {
        id: customer.id,
        hasActiveSubscription: storage.customerHasActiveSubscription(customerId),
        subscriptionIds: customer.subscriptions || []
      },
      subscriptions 
    });
  } catch (error) {
    logger.errorWithStack('Erro ao listar assinaturas do cliente', error);
    res.status(500).json({ error: 'Erro interno ao listar assinaturas do cliente' });
  }
});

// Lista clientes ativos
app.get(`${CONFIG.routes.debug}/customers/active`, (req, res) => {
  try {
    const activeCustomers = storage.getActiveCustomers();
    res.json({ 
      count: activeCustomers.length,
      customers: activeCustomers 
    });
  } catch (error) {
    logger.errorWithStack('Erro ao listar clientes ativos', error);
    res.status(500).json({ error: 'Erro interno ao listar clientes ativos' });
  }
});

// Verifica status de assinatura de um cliente
app.get(`${CONFIG.routes.debug}/customer/:id/status`, (req, res) => {
  try {
    const customerId = req.params.id;
    const hasActiveSubscription = storage.customerHasActiveSubscription(customerId);
    
    res.json({
      customerId,
      active: hasActiveSubscription,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.errorWithStack('Erro ao verificar status do cliente', error);
    res.status(500).json({ error: 'Erro interno ao verificar status do cliente' });
  }
});

// Lista dados em memória
app.get(`${CONFIG.routes.debug}/stats`, (req, res) => {
  try {
    res.json({
      timestamp: new Date().toISOString(),
      counts: {
        events: storage.storage.webhookEvents.length,
        subscriptions: Object.keys(storage.storage.subscriptions).length,
        payments: Object.keys(storage.storage.payments).length,
        customers: Object.keys(storage.storage.customers).length,
        activeCustomers: storage.getActiveCustomers().length
      },
      memory: process.memoryUsage()
    });
  } catch (error) {
    logger.errorWithStack('Erro ao obter estatísticas', error);
    res.status(500).json({ error: 'Erro interno ao obter estatísticas' });
  }
});

// Rota de health check
app.get(CONFIG.routes.health, (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    events: storage.storage.webhookEvents.length,
    subscriptions: Object.keys(storage.storage.subscriptions).length,
    payments: Object.keys(storage.storage.payments).length,
    customers: Object.keys(storage.storage.customers).length
  });
});

// Manipulador para rotas não encontradas
app.use((req, res) => {
  logger.warn(`Rota não encontrada: ${req.method} ${req.originalUrl || req.url}`);
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Manipulador de erros
app.use((err, req, res, next) => {
  logger.errorWithStack('Erro não tratado na aplicação', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Tratamento de erros não capturados no processo
process.on('uncaughtException', (err) => {
  logger.errorWithStack('Erro não capturado no processo', err);
});

process.on('unhandledRejection', (reason) => {
  logger.errorWithStack('Promessa rejeitada não tratada', reason);
});

// Inicia o servidor
const PORT = CONFIG.port;
app.listen(PORT, CONFIG.host, () => {
  logger.info(`Servidor de webhook iniciado na porta ${PORT}`);
  logger.info(`Webhook URL: http://${CONFIG.host}:${PORT}${CONFIG.routes.webhook}`);
}); 