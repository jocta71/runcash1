const { MongoClient } = require('mongodb');
const axios = require('axios');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'runcashh';
// Forçar uso do sandbox enquanto estamos em teste
const ASAAS_ENVIRONMENT = 'sandbox';
console.log(`[WEBHOOK] Usando ambiente Asaas: ${ASAAS_ENVIRONMENT}`);

const asaasBaseUrl = ASAAS_ENVIRONMENT === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';
const asaasApiKey = process.env.ASAAS_API_KEY;

// CORS Configuration
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(200).end();
  }

  // Set CORS headers for all responses
  setCorsHeaders(res);
  
  console.log('[Webhook] Requisição recebida');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body));
  
  // Check if request method is POST
  if (req.method !== 'POST') {
    console.log('[Webhook] Método não suportado:', req.method);
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  // Check for request body
  if (!req.body || Object.keys(req.body).length === 0) {
    console.log('[Webhook] Corpo da requisição vazio');
    return res.status(400).json({ error: 'Request body is empty' });
  }
  
  let client;
  
  try {
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('[Webhook] Conectado ao MongoDB');
    
    const db = client.db(DB_NAME);
    const webhooksCollection = db.collection('webhooks');
    
    // Get event data and type
    const { event, payment, subscription } = req.body;
    
    if (!event) {
      console.log('[Webhook] Tipo de evento não encontrado');
      return res.status(400).json({ error: 'Event type not found in request body' });
    }

    console.log(`[Webhook] Evento recebido: ${event}`);
    
    // Save webhook data to MongoDB for logging
    await webhooksCollection.insertOne({
      event,
      data: req.body,
      receivedAt: new Date()
    });
    
    // Process event based on type
    switch (event) {
      case 'PAYMENT_CONFIRMED':
        await handlePaymentConfirmed(db, payment);
        break;
      case 'PAYMENT_RECEIVED':
        await handlePaymentConfirmed(db, payment);
        break;
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(db, payment);
        break;
      case 'PAYMENT_REFUNDED':
        await handlePaymentRefunded(db, payment);
        break;
      case 'SUBSCRIPTION_CANCELED':
        await handleSubscriptionCanceled(db, subscription);
        break;
      case 'SUBSCRIPTION_RENEWED':
        await handleSubscriptionRenewed(db, subscription);
        break;
      case 'SUBSCRIPTION_DELETED':
        await handleSubscriptionDeleted(db, subscription);
        break;
      default:
        console.log(`[Webhook] Evento não processado: ${event}`);
    }
    
    return res.status(200).json({
      success: true,
      message: `Webhook event ${event} processed successfully`
    });
    
  } catch (error) {
    console.error('[Webhook] Erro:', error.message);
    return res.status(500).json({
      error: 'Failed to process webhook',
      message: error.message
    });
  } finally {
    // Close MongoDB connection
    if (client) {
      await client.close();
      console.log('[Webhook] Conexão MongoDB fechada');
    }
  }
};

// Event handlers

async function handlePaymentConfirmed(db, payment) {
  if (!payment || !payment.id) {
    console.log('[Webhook] Dados de pagamento inválidos');
    return;
  }

  console.log(`[Webhook] Processando pagamento confirmado: ${payment.id}`);

  const paymentsCollection = db.collection('payments');
  const customersCollection = db.collection('customers');
  
  // Update payment status in database
  const result = await paymentsCollection.updateOne(
    { asaasPaymentId: payment.id },
    { 
      $set: { 
        status: 'CONFIRMED',
        confirmedDate: new Date(),
        updatedAt: new Date()
      }
    }
  );

  console.log(`[Webhook] Pagamento atualizado: ${result.modifiedCount} documento(s)`);

  // Update customer status if payment is related to a subscription
  if (payment.subscription) {
    await customersCollection.updateOne(
      { asaasCustomerId: payment.customer },
      { 
        $set: { 
          status: 'ACTIVE',
          updatedAt: new Date()
        }
      }
    );
    console.log(`[Webhook] Status do cliente atualizado para ACTIVE`);
  }
}

async function handlePaymentOverdue(db, payment) {
  if (!payment || !payment.id) {
    console.log('[Webhook] Dados de pagamento inválidos');
    return;
  }

  console.log(`[Webhook] Processando pagamento em atraso: ${payment.id}`);

  const paymentsCollection = db.collection('payments');
  const customersCollection = db.collection('customers');
  
  // Update payment status in database
  const result = await paymentsCollection.updateOne(
    { asaasPaymentId: payment.id },
    { 
      $set: { 
        status: 'OVERDUE',
        updatedAt: new Date()
      }
    }
  );

  console.log(`[Webhook] Pagamento atualizado: ${result.modifiedCount} documento(s)`);

  // If payment is from a subscription, update customer status
  if (payment.subscription) {
    await customersCollection.updateOne(
      { asaasCustomerId: payment.customer },
      { 
        $set: { 
          status: 'INACTIVE',
          updatedAt: new Date()
        }
      }
    );
    console.log(`[Webhook] Status do cliente atualizado para INACTIVE`);
  }
}

async function handlePaymentRefunded(db, payment) {
  if (!payment || !payment.id) {
    console.log('[Webhook] Dados de pagamento inválidos');
    return;
  }

  console.log(`[Webhook] Processando pagamento reembolsado: ${payment.id}`);

  const paymentsCollection = db.collection('payments');
  
  // Update payment status in database
  const result = await paymentsCollection.updateOne(
    { asaasPaymentId: payment.id },
    { 
      $set: { 
        status: 'REFUNDED',
        refundedDate: new Date(),
        updatedAt: new Date()
      }
    }
  );

  console.log(`[Webhook] Pagamento atualizado: ${result.modifiedCount} documento(s)`);
}

async function handleSubscriptionCanceled(db, subscription) {
  if (!subscription || !subscription.id) {
    console.log('[Webhook] Dados de assinatura inválidos');
    return;
  }

  console.log(`[Webhook] Processando assinatura cancelada: ${subscription.id}`);

  const subscriptionsCollection = db.collection('subscriptions');
  const customersCollection = db.collection('customers');
  
  // Update subscription status in database
  const result = await subscriptionsCollection.updateOne(
    { asaasSubscriptionId: subscription.id },
    { 
      $set: { 
        status: 'CANCELLED',
        canceledAt: new Date(),
        updatedAt: new Date()
      }
    }
  );

  console.log(`[Webhook] Assinatura atualizada: ${result.modifiedCount} documento(s)`);

  // Update customer status
  if (result.modifiedCount > 0) {
    const subData = await subscriptionsCollection.findOne({ asaasSubscriptionId: subscription.id });
    if (subData && subData.asaasCustomerId) {
      await customersCollection.updateOne(
        { asaasCustomerId: subData.asaasCustomerId },
        { 
          $set: { 
            status: 'INACTIVE',
            updatedAt: new Date()
          }
        }
      );
      console.log(`[Webhook] Status do cliente atualizado para INACTIVE`);
    }
  }
}

async function handleSubscriptionRenewed(db, subscription) {
  if (!subscription || !subscription.id) {
    console.log('[Webhook] Dados de assinatura inválidos');
    return;
  }

  console.log(`[Webhook] Processando renovação de assinatura: ${subscription.id}`);

  const subscriptionsCollection = db.collection('subscriptions');
  
  // Update subscription in database
  const result = await subscriptionsCollection.updateOne(
    { asaasSubscriptionId: subscription.id },
    { 
      $set: { 
        status: 'ACTIVE',
        renewedAt: new Date(),
        nextDueDate: new Date(subscription.nextDueDate),
        updatedAt: new Date()
      }
    }
  );

  console.log(`[Webhook] Assinatura atualizada: ${result.modifiedCount} documento(s)`);
}

async function handleSubscriptionDeleted(db, subscription) {
  if (!subscription || !subscription.id) {
    console.log('[Webhook] Dados de assinatura inválidos');
    return;
  }

  console.log(`[Webhook] Processando exclusão de assinatura: ${subscription.id}`);

  const subscriptionsCollection = db.collection('subscriptions');
  const customersCollection = db.collection('customers');
  
  // Update subscription status in database
  const subData = await subscriptionsCollection.findOne({ asaasSubscriptionId: subscription.id });
  
  const result = await subscriptionsCollection.updateOne(
    { asaasSubscriptionId: subscription.id },
    { 
      $set: { 
        status: 'DELETED',
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    }
  );

  console.log(`[Webhook] Assinatura atualizada: ${result.modifiedCount} documento(s)`);

  // Update customer status
  if (subData && subData.asaasCustomerId) {
    await customersCollection.updateOne(
      { asaasCustomerId: subData.asaasCustomerId },
      { 
        $set: { 
          status: 'INACTIVE',
          updatedAt: new Date()
        }
      }
    );
    console.log(`[Webhook] Status do cliente atualizado para INACTIVE`);
  }
}

// Função para buscar informações atualizadas de um cliente
async function getCustomerInfo(customerId) {
  try {
    const response = await axios.get(`${asaasBaseUrl}/customers/${customerId}`, {
      headers: {
        'access_token': asaasApiKey,
        'User-Agent': 'RunCash/1.0'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar informações do cliente:', error.message);
    return null;
  }
}

// Função para fazer requisições à API Asaas
async function asaasApiRequest(endpoint, method = 'GET', data = null) {
  try {
    const url = `${asaasBaseUrl}${endpoint}`;
    const config = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey,
        'User-Agent': 'RunCash/1.0'
      },
      data: data ? data : undefined
    };
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Erro na requisição à API Asaas: ${error}`);
    throw error;
  }
} 