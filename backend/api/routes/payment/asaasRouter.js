const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// Middleware para verificar se o MongoDB está disponível
const requireDb = (req, res, next) => {
  if (!req.app.locals.db) {
    return res.status(503).json({ error: 'Banco de dados não disponível' });
  }
  next();
};

/**
 * POST /api/payment/asaas/create-customer
 * Cria um cliente no Asaas e armazena no MongoDB
 */
router.post('/create-customer', requireDb, async (req, res) => {
  // Extrair dados da requisição
  const { name, email, cpfCnpj, mobilePhone, userId } = req.body;

  // Validar campos obrigatórios
  if (!name || !email || !cpfCnpj || !mobilePhone || !userId) {
    return res.status(400).json({
      error: 'Dados incompletos',
      message: 'Todos os campos são obrigatórios: name, email, cpfCnpj, mobilePhone, userId'
    });
  }

  // Normalizar CPF/CNPJ removendo caracteres não numéricos
  const normalizedCpfCnpj = cpfCnpj.replace(/\D/g, '');
  // Normalizar telefone removendo caracteres não numéricos
  const normalizedPhone = mobilePhone.replace(/\D/g, '');

  try {
    const db = req.app.locals.db;
    
    // Verificar se já existe um cliente com este CPF/CNPJ para este usuário
    const existingCustomer = await db.collection('customers').findOne({
      userId,
      cpfCnpj: normalizedCpfCnpj
    });

    // Se já existe cliente, retornar os dados
    if (existingCustomer) {
      console.log(`Cliente já existe para o usuário ${userId} com CPF/CNPJ ${normalizedCpfCnpj}`);
      return res.status(200).json({ 
        message: 'Cliente já cadastrado',
        customer: existingCustomer
      });
    }

    // Configuração da API Asaas
    const apiKey = process.env.ASAAS_API_KEY;
    const apiBaseUrl = process.env.ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!apiKey) {
      console.error('Chave da API Asaas não configurada');
      return res.status(500).json({ error: 'Configuração do servidor incompleta' });
    }

    // Preparar dados para a API Asaas
    const customerData = {
      name,
      email,
      cpfCnpj: normalizedCpfCnpj,
      mobilePhone: normalizedPhone,
      notificationDisabled: false,
      externalReference: userId // Usar o ID do usuário como referência externa
    };

    // Realizar requisição para a API Asaas
    console.log('Enviando requisição para criação de cliente no Asaas');
    const response = await axios.post(`${apiBaseUrl}/customers`, customerData, {
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      }
    });

    console.log('Resposta da API Asaas:', response.data);

    // Salvar dados do cliente no MongoDB
    const newCustomer = {
      userId,
      name,
      email,
      cpfCnpj: normalizedCpfCnpj,
      mobilePhone: normalizedPhone,
      asaasId: response.data.id,
      asaasData: response.data,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.collection('customers').insertOne(newCustomer);
    console.log(`Cliente ${name} criado com sucesso no MongoDB e Asaas`);

    // Retornar sucesso
    return res.status(201).json({
      message: 'Cliente criado com sucesso',
      customer: newCustomer
    });

  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    
    // Verificar se o erro é da API Asaas
    if (error.response && error.response.data) {
      console.error('Erro API Asaas:', error.response.data);
      return res.status(error.response.status || 500).json({
        error: 'Erro ao processar a requisição no Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({ 
      error: 'Erro ao processar a requisição',
      message: error.message 
    });
  }
});

/**
 * POST /api/payment/asaas/create-subscription
 * Cria uma assinatura no Asaas e armazena no MongoDB
 */
router.post('/create-subscription', requireDb, async (req, res) => {
  // Extrair dados do corpo da requisição
  const {
    customerId,
    planId,
    userId,
    creditCard,
    creditCardHolderInfo,
    billingType = 'CREDIT_CARD',
    nextDueDate,
    value
  } = req.body;

  // Validação dos campos obrigatórios
  if (!customerId || !planId || !userId) {
    return res.status(400).json({
      error: 'Dados incompletos',
      message: 'Os campos customerId, planId e userId são obrigatórios'
    });
  }

  // Para pagamentos com cartão de crédito, validar dados do cartão
  if (billingType === 'CREDIT_CARD') {
    if (!creditCard || !creditCardHolderInfo) {
      return res.status(400).json({
        error: 'Dados de pagamento incompletos',
        message: 'Para pagamento com cartão, é necessário fornecer os dados do cartão e do titular'
      });
    }
    
    // Validar informações do titular do cartão
    const { name, email, cpfCnpj, postalCode, addressNumber, phone } = creditCardHolderInfo;
    if (!name || !email || !cpfCnpj || !postalCode || !addressNumber || !phone) {
      return res.status(400).json({
        error: 'Dados do titular incompletos',
        message: 'Todos os dados do titular do cartão são obrigatórios'
      });
    }
  }

  try {
    const db = req.app.locals.db;

    // Configuração da API Asaas
    const apiKey = process.env.ASAAS_API_KEY;
    const apiBaseUrl = process.env.ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!apiKey) {
      console.error('Chave da API Asaas não configurada');
      return res.status(500).json({ error: 'Configuração do servidor incompleta' });
    }

    // Buscar informações do plano
    const plan = await db.collection('plans').findOne({ _id: planId });
    if (!plan) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    // Preparar dados da assinatura
    const subscription = {
      customer: customerId,
      billingType,
      value: value || plan.price,
      nextDueDate: nextDueDate || new Date().toISOString().split('T')[0], // Formato YYYY-MM-DD
      cycle: 'MONTHLY',
      description: `Assinatura do plano ${plan.name}`,
      externalReference: userId
    };

    // Adicionar dados do cartão para pagamento com cartão de crédito
    if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
      subscription.creditCard = creditCard;
      subscription.creditCardHolderInfo = creditCardHolderInfo;
    }

    console.log('Criando assinatura no Asaas:', JSON.stringify(subscription, null, 2).replace(/,"creditCard":\{.*?\}/g, ',"creditCard":"[REDACTED]"'));

    // Criar assinatura na API Asaas
    const response = await axios.post(`${apiBaseUrl}/subscriptions`, subscription, {
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      }
    });

    console.log('Resposta da criação de assinatura:', response.data);

    // Salvar assinatura no MongoDB
    const subscriptionData = {
      userId,
      planId,
      customerId,
      asaasId: response.data.id,
      status: response.data.status,
      value: response.data.value,
      nextDueDate: response.data.nextDueDate,
      cycle: response.data.cycle,
      billingType: response.data.billingType,
      description: response.data.description,
      asaasData: response.data,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('subscriptions').insertOne(subscriptionData);
    console.log(`Assinatura salva no MongoDB com ID: ${result.insertedId}`);

    // Atualizar usuário com informações da assinatura (plano ativo)
    await db.collection('users').updateOne(
      { _id: userId },
      { 
        $set: { 
          activePlan: planId,
          activeSubscription: subscriptionData.asaasId,
          subscriptionStatus: response.data.status,
          updated_at: new Date()
        } 
      }
    );

    return res.status(201).json({
      message: 'Assinatura criada com sucesso',
      subscription: {
        id: response.data.id,
        status: response.data.status,
        nextDueDate: response.data.nextDueDate
      }
    });

  } catch (error) {
    console.error('Erro ao criar assinatura:', error);
    
    // Verificar se o erro é da API Asaas
    if (error.response && error.response.data) {
      console.error('Erro API Asaas:', error.response.data);
      return res.status(error.response.status || 500).json({
        error: 'Erro ao processar a requisição no Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({ 
      error: 'Erro ao processar a requisição',
      message: error.message 
    });
  }
});

/**
 * POST /api/payment/asaas/webhook
 * Recebe notificações de webhook do Asaas
 */
router.post('/webhook', requireDb, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Verificar se a requisição está vindo realmente do Asaas
    const asaasSignature = req.headers['x-asaas-access-token'];
    
    if (!asaasSignature) {
      console.warn('Requisição sem assinatura do Asaas');
      // Em produção, descomentar a linha abaixo para exigir assinatura
      // return res.status(401).json({ error: 'Assinatura Asaas ausente' });
    }
    
    // Em produção, validar a assinatura do Asaas
    const WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET;
    
    if (WEBHOOK_SECRET && asaasSignature) {
      // Validando assinatura - apenas para ambiente de produção
      const requestBody = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(requestBody)
        .digest('hex');
        
      if (asaasSignature !== expectedSignature) {
        console.warn('Assinatura do webhook inválida');
        return res.status(401).json({ error: 'Assinatura inválida' });
      }
    }

    const event = req.body;
    console.log('Webhook recebido do Asaas:', JSON.stringify(event));

    // Verificar se os dados do evento são válidos
    if (!event || !event.event || !event.payment) {
      console.error('Formato inválido de webhook');
      return res.status(400).json({ error: 'Formato inválido de webhook' });
    }

    // Dados do pagamento/assinatura
    const paymentId = event.payment.id;
    const subscriptionId = event.payment.subscription;
    const eventType = event.event;
    const status = event.payment.status;
    
    console.log(`Processando evento: ${eventType} para pagamento: ${paymentId}, status: ${status}, assinatura: ${subscriptionId || 'N/A'}`);

    // Registrar o evento na tabela de logs
    await db.collection('webhook_logs').insertOne({
      provider: 'asaas',
      event_type: eventType,
      event_data: event,
      payment_id: paymentId,
      subscription_id: subscriptionId,
      received_at: new Date(),
      processed: false
    });

    // Se não for uma assinatura, simplesmente registramos o evento
    if (!subscriptionId) {
      console.log('Evento não relacionado a assinatura. Apenas registrado.');
      return res.status(200).json({ message: 'Evento registrado com sucesso' });
    }

    // Processar evento com base no tipo
    switch (eventType) {
      case 'PAYMENT_CREATED':
      case 'PAYMENT_UPDATED':
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_OVERDUE':
      case 'PAYMENT_DELETED':
      case 'PAYMENT_RESTORED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_CANCELED':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
      case 'PAYMENT_CHARGEBACK_DISPUTE':
      case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
      case 'PAYMENT_DUNNING_RECEIVED':
      case 'PAYMENT_DUNNING_REQUESTED':
        // Atualizar status da assinatura no banco de dados
        await processPaymentEvent(db, event, subscriptionId);
        break;
      
      case 'SUBSCRIPTION_CREATED':
      case 'SUBSCRIPTION_UPDATED':
      case 'SUBSCRIPTION_CANCELED':
      case 'SUBSCRIPTION_ENDED':
      case 'SUBSCRIPTION_EXPIRED':
      case 'SUBSCRIPTION_ACTIVATED':
      case 'SUBSCRIPTION_RENEWED':
        // Atualizar status da assinatura no banco de dados
        await processSubscriptionEvent(db, event, subscriptionId);
        break;
      
      default:
        console.log(`Tipo de evento não processado: ${eventType}`);
    }

    // Marcar o evento como processado
    await db.collection('webhook_logs').updateOne(
      { 'event_data.payment.id': paymentId },
      { $set: { processed: true, processed_at: new Date() } }
    );

    return res.status(200).json({ 
      message: 'Webhook processado com sucesso',
      event: eventType,
      status: 'success'
    });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({ 
      error: 'Erro ao processar webhook',
      message: error.message
    });
  }
});

/**
 * Rotas de compatibilidade para URLs antigas
 * Permite que o frontend continue chamando os endpoints antigos
 */
router.post('/api/asaas-create-customer', (req, res) => {
  // Redirecionar para o novo endpoint
  return router.handle(req, res, '/create-customer');
});

router.post('/api/asaas-create-subscription', (req, res) => {
  // Redirecionar para o novo endpoint
  return router.handle(req, res, '/create-subscription');
});

router.post('/api/asaas-webhook', (req, res) => {
  // Redirecionar para o novo endpoint
  return router.handle(req, res, '/webhook');
});

// Funções auxiliares para processamento de eventos

// Processa eventos relacionados a pagamentos
async function processPaymentEvent(db, event, subscriptionId) {
  const paymentStatus = event.payment.status;
  let subscriptionStatus;

  // Mapear status do pagamento para status da assinatura
  switch (paymentStatus) {
    case 'CONFIRMED':
    case 'RECEIVED':
      subscriptionStatus = 'active';
      break;
    case 'OVERDUE':
      subscriptionStatus = 'overdue';
      break;
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'REFUND_IN_PROGRESS':
      subscriptionStatus = 'refunded';
      break;
    case 'PENDING':
    case 'AWAITING_RISK_ANALYSIS':
      subscriptionStatus = 'pending';
      break;
    default:
      subscriptionStatus = 'pending';
  }

  try {
    // Buscar assinatura pelo ID de referência do Asaas
    const subscription = await db.collection('subscriptions').findOne({
      asaasId: subscriptionId
    });

    if (!subscription) {
      console.error(`Assinatura não encontrada para o ID: ${subscriptionId}`);
      return;
    }

    // Atualizar status da assinatura
    await db.collection('subscriptions').updateOne(
      { asaasId: subscriptionId },
      { 
        $set: { 
          status: subscriptionStatus,
          updated_at: new Date(),
          payment_status: paymentStatus,
          payment_last_event: event.event,
          payment_last_update: new Date()
        } 
      }
    );

    console.log(`Assinatura ${subscriptionId} atualizada para ${subscriptionStatus}.`);

    // Para pagamentos confirmados, atualizar a data de validade da assinatura
    if (paymentStatus === 'CONFIRMED' || paymentStatus === 'RECEIVED') {
      // Obter período do plano
      const plan = await db.collection('plans').findOne({ _id: subscription.planId });
      const interval = plan && plan.interval === 'yearly' ? 365 : 30; // Default para mensal
      
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + interval);
      
      await db.collection('subscriptions').updateOne(
        { asaasId: subscriptionId },
        { 
          $set: { 
            valid_until: expiryDate
          } 
        }
      );
      
      // Atualizar status do usuário
      await db.collection('users').updateOne(
        { _id: subscription.userId },
        { 
          $set: { 
            subscriptionStatus: subscriptionStatus,
            updated_at: new Date()
          } 
        }
      );
      
      console.log(`Validade da assinatura ${subscriptionId} definida até ${expiryDate.toISOString()}`);
    }
  } catch (error) {
    console.error(`Erro ao processar evento de pagamento: ${error.message}`);
    throw error;
  }
}

// Processa eventos relacionados a assinaturas
async function processSubscriptionEvent(db, event, subscriptionId) {
  const subscriptionStatus = event.subscription.status;
  let dbSubscriptionStatus;

  // Mapear status da assinatura do Asaas para nosso status interno
  switch (subscriptionStatus) {
    case 'ACTIVE':
      dbSubscriptionStatus = 'active';
      break;
    case 'EXPIRED':
      dbSubscriptionStatus = 'expired';
      break;
    case 'OVERDUE':
      dbSubscriptionStatus = 'overdue';
      break;
    case 'CANCELED':
      dbSubscriptionStatus = 'cancelled';
      break;
    case 'ENDED':
      dbSubscriptionStatus = 'ended';
      break;
    default:
      dbSubscriptionStatus = 'pending';
  }

  try {
    // Atualizar status da assinatura no banco de dados
    await db.collection('subscriptions').updateOne(
      { asaasId: subscriptionId },
      { 
        $set: { 
          status: dbSubscriptionStatus,
          updated_at: new Date(),
          subscription_status: subscriptionStatus,
          subscription_last_event: event.event,
          subscription_last_update: new Date()
        } 
      }
    );

    // Buscar a assinatura para atualizar o usuário
    const subscription = await db.collection('subscriptions').findOne({ asaasId: subscriptionId });
    
    if (subscription && subscription.userId) {
      await db.collection('users').updateOne(
        { _id: subscription.userId },
        { 
          $set: { 
            subscriptionStatus: dbSubscriptionStatus,
            updated_at: new Date()
          } 
        }
      );
    }

    console.log(`Status da assinatura ${subscriptionId} atualizado para ${dbSubscriptionStatus}`);
  } catch (error) {
    console.error(`Erro ao processar evento de assinatura: ${error.message}`);
    throw error;
  }
}

module.exports = router; 