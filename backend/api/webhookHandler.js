const { MongoClient } = require('mongodb');

// URL de conexão do MongoDB
const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

/**
 * Manipulador para eventos de webhook do Asaas
 * Esta função é chamada diretamente na configuração do Express
 */
async function asaasWebhookHandler(req, res) {
  console.log('[WEBHOOK] Requisição recebida:', {
    path: req.path,
    method: req.method,
    headers: req.headers,
    body: req.body
  });
  
  try {
    // Verificar se o corpo da requisição contém dados básicos necessários
    if (!req.body || !req.body.event) {
      console.error('[WEBHOOK] Webhook inválido: corpo da requisição não contém evento');
      return res.status(400).json({ success: false, message: 'Webhook inválido: corpo da requisição não contém evento' });
    }

    // Extrair dados comuns do webhook
    const { event, id: eventId, dateCreated } = req.body;
    
    // Determinar o tipo de evento para processamento adequado
    const subscriptionEvents = ['SUBSCRIPTION_CREATED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_UPDATED', 
                         'SUBSCRIPTION_PAID', 'SUBSCRIPTION_CANCELED', 'SUBSCRIPTION_OVERDUE', 'SUBSCRIPTION_DELETED'];
    
    const paymentEvents = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', 'PAYMENT_DELETED',
                           'PAYMENT_UPDATED', 'PAYMENT_CREATED', 'PAYMENT_REFUNDED', 'PAYMENT_REFUND_CONFIRMED'];
    
    // Processar eventos de assinatura
    if (subscriptionEvents.includes(event)) {
      return await processSubscriptionEvent(req, res);
    } 
    // Processar eventos de pagamento
    else if (paymentEvents.includes(event)) {
      return await processPaymentEvent(req, res);
    }
    // Outros tipos de eventos
    else {
      console.log(`[WEBHOOK] Evento ignorado: ${event} - não é um evento de interesse`);
      return res.status(200).json({ 
        success: true, 
        message: `Evento ignorado: ${event} - não é um evento de interesse` 
      });
    }
    
  } catch (error) {
    console.error('[WEBHOOK] Erro ao processar webhook:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao processar webhook', 
      error: error.message 
    });
  }
}

/**
 * Função para processar eventos de assinatura
 */
async function processSubscriptionEvent(req, res) {
  const { event, subscription } = req.body;
  
  // Verificar se o corpo contém dados de assinatura
  if (!subscription) {
    console.error('[WEBHOOK] Webhook inválido: evento de assinatura sem dados de assinatura');
    return res.status(400).json({ 
      success: false, 
      message: 'Webhook inválido: evento de assinatura sem dados de assinatura' 
    });
  }
  
  // Extrair informações relevantes da assinatura
  const { id: subscriptionId, customer: customerId, status, value, cycle, nextDueDate } = subscription;
  
  console.log(`[WEBHOOK] Processando evento ${event} para assinatura ${subscriptionId} (cliente ${customerId})`);

  // Determinar o status correto a ser salvo com base no evento
  let statusToSave;
  
  // Lógica para definir o status adequado baseado no tipo de evento
  if (event === 'SUBSCRIPTION_CREATED') {
    // Para assinaturas novas, sempre começar como 'pending' até confirmar pagamento
    statusToSave = 'pending';
    console.log(`[WEBHOOK] Assinatura nova criada, definindo status como 'pending' independentemente do status do Asaas: ${status}`);
  } else if (event === 'SUBSCRIPTION_PAID' || event === 'SUBSCRIPTION_RENEWED') {
    // Para pagamentos confirmados e renovações, definir como 'active'
    statusToSave = 'active';
    console.log(`[WEBHOOK] Pagamento confirmado ou renovação, definindo status como 'active'`);
  } else if (event === 'SUBSCRIPTION_OVERDUE') {
    // Para assinaturas em atraso
    statusToSave = 'overdue';
    console.log(`[WEBHOOK] Assinatura em atraso, definindo status como 'overdue'`);
  } else if (event === 'SUBSCRIPTION_CANCELED' || event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') {
    // Para assinaturas canceladas ou removidas
    statusToSave = 'inactive';
    console.log(`[WEBHOOK] Assinatura cancelada/removida, definindo status como 'inactive'`);
  } else {
    // Para outros eventos, usar o status enviado pelo Asaas (convertido para minúsculo)
    statusToSave = status.toLowerCase();
    console.log(`[WEBHOOK] Usando status do Asaas: ${statusToSave}`);
  }

  // Conectar ao MongoDB
  console.log(`[WEBHOOK] Conectando ao MongoDB: ${url}`);
  const client = new MongoClient(url, { useUnifiedTopology: true });
  await client.connect();
  console.log('[WEBHOOK] Conectado ao MongoDB');
  
  const db = client.db(dbName);
  
  try {
    // Atualizar na coleção de subscriptions
    const subscriptionResult = await db.collection('subscriptions').updateOne(
      { customerId: customerId },
      { 
        $set: {
          subscriptionId: subscriptionId,
          customerId: customerId,
          status: statusToSave, // Usando o status calculado baseado no evento
          updatedAt: new Date(),
          // Campos adicionais para diagnóstico
          originalAsaasStatus: status,
          lastEvent: event,
          pendingFirstPayment: event === 'SUBSCRIPTION_CREATED',
          lastEventDate: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log(`[WEBHOOK] Atualização na coleção subscriptions: ${JSON.stringify(subscriptionResult)}`);
    
    // Atualizar na coleção de userSubscriptions
    const userSubscriptionResult = await db.collection('userSubscriptions').updateOne(
      { customerId: customerId },
      {
        $set: {
          customerId: customerId,
          subscriptionId: subscriptionId,
          status: statusToSave, // Usando o status calculado baseado no evento
          value: value,
          cycle: cycle,
          nextDueDate: nextDueDate,
          updatedAt: new Date(),
          // Campos adicionais para diagnóstico
          originalAsaasStatus: status,
          lastEvent: event,
          pendingFirstPayment: event === 'SUBSCRIPTION_CREATED',
          lastEventDate: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log(`[WEBHOOK] Atualização na coleção userSubscriptions: ${JSON.stringify(userSubscriptionResult)}`);
    
    return res.status(200).json({ 
      success: true, 
      message: `Webhook processado com sucesso: ${event}`,
      subscriptionId: subscriptionId,
      customerId: customerId,
      status: statusToSave, // Retornando o status que foi salvo
      originalAsaasStatus: status // Incluindo o status original do Asaas na resposta
    });
  } finally {
    // Fechar conexão
    await client.close();
    console.log('[WEBHOOK] Conexão com MongoDB fechada');
  }
}

/**
 * Função para processar eventos de pagamento
 */
async function processPaymentEvent(req, res) {
  const { event, payment } = req.body;
  
  // Verificar se o corpo contém dados de pagamento
  if (!payment) {
    console.error('[WEBHOOK] Webhook inválido: evento de pagamento sem dados de pagamento');
    return res.status(400).json({ 
      success: false, 
      message: 'Webhook inválido: evento de pagamento sem dados de pagamento' 
    });
  }
  
  // Extrair informações relevantes do pagamento
  const { id: paymentId, customer: customerId, subscription: subscriptionId, status, value, billingType } = payment;
  
  console.log(`[WEBHOOK] Processando evento ${event} para pagamento ${paymentId} (cliente ${customerId})`);

  // Se não houver subscriptionId, apenas registramos o pagamento mas não atualizamos assinaturas
  if (!subscriptionId) {
    console.log(`[WEBHOOK] Pagamento ${paymentId} não está relacionado a nenhuma assinatura`);
    return res.status(200).json({ 
      success: true, 
      message: `Pagamento processado, mas não está relacionado a uma assinatura`,
      paymentId: paymentId,
      customerId: customerId
    });
  }

  // Conectar ao MongoDB
  console.log(`[WEBHOOK] Conectando ao MongoDB: ${url}`);
  const client = new MongoClient(url, { useUnifiedTopology: true });
  await client.connect();
  console.log('[WEBHOOK] Conectado ao MongoDB');
  
  const db = client.db(dbName);
  
  try {
    // Se o pagamento estiver confirmado/recebido, atualizamos o status da assinatura
    if (status === 'RECEIVED' || status === 'CONFIRMED') {
      // Atualizar na coleção de subscriptions
      const subscriptionResult = await db.collection('subscriptions').updateOne(
        { subscriptionId: subscriptionId },
        { 
          $set: {
            status: 'active', // Pagamento recebido = assinatura ativa
            updatedAt: new Date(),
            pendingFirstPayment: false // Garantir que pendingFirstPayment seja atualizado aqui também
          }
        },
        { upsert: false } // Não criar se não existir
      );
      
      console.log(`[WEBHOOK] Atualização na coleção subscriptions após pagamento: ${JSON.stringify(subscriptionResult)}`);
      
      // Atualizar último pagamento na coleção de userSubscriptions
      const userSubscriptionResult = await db.collection('userSubscriptions').updateOne(
        { subscriptionId: subscriptionId },
        {
          $set: {
            status: 'active',
            lastPaymentId: paymentId,
            lastPaymentDate: new Date(),
            lastPaymentValue: value,
            updatedAt: new Date(),
            pendingFirstPayment: false // Atualização para corrigir a inconsistência
          }
        },
        { upsert: false } // Não criar se não existir
      );
      
      console.log(`[WEBHOOK] Atualização na coleção userSubscriptions após pagamento: ${JSON.stringify(userSubscriptionResult)}`);
    }
    
    // Registrar o pagamento na coleção de payments
    const paymentResult = await db.collection('payments').updateOne(
      { paymentId: paymentId },
      {
        $set: {
          paymentId: paymentId,
          customerId: customerId,
          subscriptionId: subscriptionId,
          value: value,
          status: status.toLowerCase(),
          billingType: billingType,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log(`[WEBHOOK] Registro na coleção payments: ${JSON.stringify(paymentResult)}`);
    
    return res.status(200).json({ 
      success: true, 
      message: `Webhook de pagamento processado com sucesso: ${event}`,
      paymentId: paymentId,
      customerId: customerId,
      subscriptionId: subscriptionId,
      status: status
    });
  } finally {
    // Fechar conexão
    await client.close();
    console.log('[WEBHOOK] Conexão com MongoDB fechada');
  }
}

module.exports = asaasWebhookHandler; 