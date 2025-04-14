const { connectToDatabase } = require('./common/mongodb');
const { ObjectId } = require('mongodb');
const { verifyAsaasRequest } = require('./utils/asaas-helpers');
const { asyncHandler } = require('./common/error-handler');

// Tipos de eventos do Asaas que podemos processar
const VALID_EVENT_TYPES = [
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED', 
  'SUBSCRIPTION_INACTIVATED',  // Em vez de SUBSCRIPTION_CANCELLED
  'SUBSCRIPTION_DELETED'       // Adicionado
];

/**
 * Processar eventos de pagamento do Asaas
 * @param {Object} event - Evento do Asaas
 * @param {Object} db - Conexão com o banco de dados
 * @returns {Object} - Resultado do processamento
 */
const processPaymentEvent = async (event, db) => {
  console.log(`Processando evento de pagamento: ${event.event}`);
  
  try {
    // Extrair informações do pagamento
    const { 
      payment,
      subscription
    } = event;
    
    if (!payment) {
      console.error('Dados de pagamento não encontrados no evento');
      return { success: false, message: 'Dados de pagamento não encontrados' };
    }

    // Extrair o ID do usuário do campo de referência externa
    // Formato esperado: userId:123456
    const externalReference = payment.externalReference || '';
    const userId = externalReference.startsWith('userId:') 
      ? externalReference.split(':')[1] 
      : null;
    
    if (!userId) {
      console.error('ID do usuário não encontrado na referência externa:', externalReference);
      return { success: false, message: 'ID do usuário não encontrado' };
    }
    
    // Atualizar o status da assinatura do usuário
    const planCollection = db.collection('plans');
    const userCollection = db.collection('users');
    
    // Verificar se o usuário existe
    const userObjectId = new ObjectId(userId);
    const user = await userCollection.findOne({ _id: userObjectId });
    
    if (!user) {
      console.error(`Usuário com ID ${userId} não encontrado`);
      return { success: false, message: 'Usuário não encontrado' };
    }
    
    // Determinar o status da assinatura com base no evento
    let subscriptionStatus;
    let planId = payment.description ? payment.description.toLowerCase() : 'basic';
    
    switch (event.event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        subscriptionStatus = 'active';
        break;
      case 'PAYMENT_OVERDUE':
        subscriptionStatus = 'overdue';
        break;
      case 'PAYMENT_REFUNDED':
        subscriptionStatus = 'cancelled';
        break;
      default:
        subscriptionStatus = 'pending';
    }
    
    // Atualizar ou criar o registro de assinatura
    const updateResult = await planCollection.updateOne(
      { userId: userId },
      { 
        $set: {
          status: subscriptionStatus,
          planType: planId === 'pro' ? 'pro' : 'basic',
          paymentId: payment.id,
          subscriptionId: subscription ? subscription.id : null,
          provider: 'asaas',
          updatedAt: new Date(),
          metadata: {
            ...payment,
            provider: 'asaas'
          }
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log(`Assinatura atualizada para o usuário ${userId}: ${subscriptionStatus}, plano: ${planId}`);
    return { 
      success: true, 
      message: 'Evento de pagamento processado com sucesso',
      data: {
        userId,
        planId,
        status: subscriptionStatus
      }
    };
  } catch (error) {
    console.error('Erro ao processar evento de pagamento:', error);
    return { success: false, message: 'Erro ao processar evento de pagamento', error: error.message };
  }
};

/**
 * Processar eventos de assinatura do Asaas
 * @param {Object} event - Evento do Asaas
 * @param {Object} db - Conexão com o banco de dados
 * @returns {Object} - Resultado do processamento
 */
const processSubscriptionEvent = async (event, db) => {
  console.log(`Processando evento de assinatura: ${event.event}`);
  
  try {
    const { subscription } = event;
    
    if (!subscription) {
      console.error('Dados de assinatura não encontrados no evento');
      return { success: false, message: 'Dados de assinatura não encontrados' };
    }
    
    // Extrair o ID do usuário do campo de referência externa
    const externalReference = subscription.externalReference || '';
    const userId = externalReference.startsWith('userId:') 
      ? externalReference.split(':')[1] 
      : null;
    
    if (!userId) {
      console.error('ID do usuário não encontrado na referência externa:', externalReference);
      return { success: false, message: 'ID do usuário não encontrado' };
    }
    
    // Determinar o status da assinatura com base no evento
    let subscriptionStatus;
    let planId = subscription.description ? subscription.description.toLowerCase() : 'basic';
    
    switch (event.event) {
      case 'SUBSCRIPTION_CREATED':
        subscriptionStatus = 'active';
        break;
      case 'SUBSCRIPTION_UPDATED':
        subscriptionStatus = 'active';
        break;
      case 'SUBSCRIPTION_INACTIVATED':
      case 'SUBSCRIPTION_DELETED':
        subscriptionStatus = 'cancelled';
        break;
      default:
        subscriptionStatus = 'pending';
    }
    
    // Atualizar ou criar o registro de assinatura
    const planCollection = db.collection('plans');
    await planCollection.updateOne(
      { userId: userId },
      { 
        $set: {
          status: subscriptionStatus,
          planType: planId === 'pro' ? 'pro' : 'basic',
          subscriptionId: subscription.id,
          provider: 'asaas',
          updatedAt: new Date(),
          metadata: {
            ...subscription,
            provider: 'asaas'
          }
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log(`Assinatura ${subscription.id} atualizada para o usuário ${userId}: ${subscriptionStatus}`);
    return { 
      success: true, 
      message: 'Evento de assinatura processado com sucesso',
      data: {
        userId,
        subscriptionId: subscription.id,
        status: subscriptionStatus
      }
    };
  } catch (error) {
    console.error('Erro ao processar evento de assinatura:', error);
    return { success: false, message: 'Erro ao processar evento de assinatura', error: error.message };
  }
};

// Função principal para processar o webhook
const asaasWebhookHandler = asyncHandler(async (req, res) => {
  // Verificar assinatura do webhook
  const isValidRequest = verifyAsaasRequest(req);
  
  if (!isValidRequest) {
    console.error('Requisição de webhook inválida');
    return res.status(401).json({ message: 'Assinatura de webhook inválida' });
  }
  
  const event = req.body;
  
  // Verificar se temos um tipo de evento válido
  if (!event || !event.event || !VALID_EVENT_TYPES.includes(event.event)) {
    console.error(`Tipo de evento inválido ou não suportado: ${event?.event}`);
    return res.status(400).json({ message: 'Tipo de evento inválido ou não suportado' });
  }
  
  // Conectar ao banco de dados
  const { db } = await connectToDatabase();
  
  // Processar com base no tipo de evento
  let result;
  
  if (event.event.startsWith('PAYMENT_')) {
    result = await processPaymentEvent(event, db);
  } else if (event.event.startsWith('SUBSCRIPTION_')) {
    result = await processSubscriptionEvent(event, db);
  } else {
    console.warn(`Tipo de evento não implementado: ${event.event}`);
    return res.status(202).json({ message: 'Tipo de evento aceito mas não processado' });
  }
  
  // Responder com base no resultado do processamento
  if (result.success) {
    return res.status(200).json({ message: result.message, data: result.data });
  } else {
    return res.status(500).json({ message: result.message, error: result.error });
  }
});

module.exports = asaasWebhookHandler; 