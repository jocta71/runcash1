const { MongoClient } = require('mongodb');
const axios = require('axios');

const MONGODB_URI = process.env.MONGODB_URI;
// Forçar uso do sandbox enquanto estamos em teste
const ASAAS_ENVIRONMENT = 'sandbox';
console.log(`[WEBHOOK] Usando ambiente Asaas: ${ASAAS_ENVIRONMENT}`);

const asaasBaseUrl = ASAAS_ENVIRONMENT === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';
const asaasApiKey = process.env.ASAAS_API_KEY;

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Resposta para solicitações GET (verificação do endpoint)
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Webhook endpoint está ativo e funcionando'
    });
  }

  // Apenas processar solicitações POST para webhooks
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verificar se há um corpo de requisição
  if (!req.body) {
    return res.status(400).json({ error: 'Corpo da requisição vazio' });
  }

  const webhookData = req.body;
  
  // Identificar o tipo de evento
  const event = webhookData.event;
  
  if (!event) {
    return res.status(400).json({ error: 'Tipo de evento não identificado' });
  }

  let client;
  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();

    // Registrar o webhook recebido para fins de auditoria
    await db.collection('webhooks').insertOne({
      event: event,
      data: webhookData,
      receivedAt: new Date()
    });

    // Processar o evento com base no tipo
    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        await handlePaymentConfirmed(db, webhookData);
        break;
      
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(db, webhookData);
        break;
      
      case 'PAYMENT_REFUNDED':
        await handlePaymentRefunded(db, webhookData);
        break;
      
      case 'SUBSCRIPTION_CANCELED':
        await handleSubscriptionCanceled(db, webhookData);
        break;
      
      case 'SUBSCRIPTION_RENEWED':
        await handleSubscriptionRenewed(db, webhookData);
        break;
        
      case 'SUBSCRIPTION_DELETED':
        await handleSubscriptionDeleted(db, webhookData);
        break;
        
      case 'SUBSCRIPTION_CREATED':
        await handleSubscriptionCreated(webhookData, db);
        break;
        
      default:
        console.log(`Evento não tratado: ${event}`);
    }

    return res.status(200).json({ message: 'Webhook processado com sucesso' });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({ error: 'Erro interno ao processar webhook' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Funções para manipulação de eventos específicos

async function handlePaymentConfirmed(db, webhookData) {
  const payment = webhookData.payment;
  if (!payment || !payment.id) return;

  const paymentId = payment.id;
  const subscriptionId = payment.subscription;
  
  // Atualizar status do pagamento
  if (paymentId) {
    await db.collection('payments').updateOne(
      { asaasId: paymentId },
      { 
        $set: { 
          status: 'CONFIRMED',
          confirmedDate: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }
  
  // Se houver uma assinatura associada, atualizar status
  if (subscriptionId) {
    await db.collection('subscriptions').updateOne(
      { asaasId: subscriptionId },
      { 
        $set: { 
          status: 'ACTIVE',
          updatedAt: new Date()
        }
      }
    );
    
    // Buscar usuário associado à assinatura e atualizar status
    const subscription = await db.collection('subscriptions').findOne({ asaasId: subscriptionId });
    if (subscription && subscription.customerId) {
      await db.collection('customers').updateOne(
        { asaasId: subscription.customerId },
        {
          $set: {
            subscriptionStatus: 'ACTIVE',
            updatedAt: new Date()
          }
        }
      );
    }
  }

  // Atualizar status do pagamento no Asaas
  const response = await axios.get(
    `${asaasBaseUrl}/payments/${paymentId}`,
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RunCash/1.0',
        'access_token': asaasApiKey
      }
    }
  );
}

async function handlePaymentOverdue(db, webhookData) {
  const payment = webhookData.payment;
  if (!payment || !payment.id) return;
  
  const paymentId = payment.id;
  const subscriptionId = payment.subscription;
  
  // Atualizar status do pagamento
  if (paymentId) {
    await db.collection('payments').updateOne(
      { asaasId: paymentId },
      { 
        $set: { 
          status: 'OVERDUE',
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }
  
  // Se houver uma assinatura associada, atualizar status
  if (subscriptionId) {
    await db.collection('subscriptions').updateOne(
      { asaasId: subscriptionId },
      { 
        $set: { 
          status: 'INACTIVE',
          updatedAt: new Date()
        }
      }
    );
    
    // Buscar usuário associado à assinatura e atualizar status
    const subscription = await db.collection('subscriptions').findOne({ asaasId: subscriptionId });
    if (subscription && subscription.customerId) {
      await db.collection('customers').updateOne(
        { asaasId: subscription.customerId },
        {
          $set: {
            subscriptionStatus: 'INACTIVE',
            updatedAt: new Date()
          }
        }
      );
    }
  }
}

async function handlePaymentRefunded(db, webhookData) {
  const payment = webhookData.payment;
  if (!payment || !payment.id) return;
  
  const paymentId = payment.id;
  
  // Atualizar status do pagamento
  if (paymentId) {
    await db.collection('payments').updateOne(
      { asaasId: paymentId },
      { 
        $set: { 
          status: 'REFUNDED',
          refundedDate: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }
}

async function handleSubscriptionCanceled(db, webhookData) {
  const subscription = webhookData.subscription;
  if (!subscription || !subscription.id) return;
  
  const subscriptionId = subscription.id;
  
  // Atualizar status da assinatura
  await db.collection('subscriptions').updateOne(
    { asaasId: subscriptionId },
    { 
      $set: { 
        status: 'CANCELLED',
        canceledDate: new Date(),
        updatedAt: new Date()
      }
    }
  );
  
  // Buscar usuário associado à assinatura e atualizar status
  const sub = await db.collection('subscriptions').findOne({ asaasId: subscriptionId });
  if (sub && sub.customerId) {
    await db.collection('customers').updateOne(
      { asaasId: sub.customerId },
      {
        $set: {
          subscriptionStatus: 'CANCELLED',
          updatedAt: new Date()
        }
      }
    );
  }
}

async function handleSubscriptionRenewed(db, webhookData) {
  const subscription = webhookData.subscription;
  if (!subscription || !subscription.id) return;
  
  const subscriptionId = subscription.id;
  
  // Atualizar detalhes da assinatura
  await db.collection('subscriptions').updateOne(
    { asaasId: subscriptionId },
    { 
      $set: { 
        status: 'ACTIVE',
        nextDueDate: subscription.nextDueDate,
        updatedAt: new Date()
      }
    }
  );
}

async function handleSubscriptionDeleted(db, webhookData) {
  const subscription = webhookData.subscription;
  if (!subscription || !subscription.id) return;
  
  const subscriptionId = subscription.id;
  
  // Atualizar status da assinatura
  await db.collection('subscriptions').updateOne(
    { asaasId: subscriptionId },
    { 
      $set: { 
        status: 'DELETED',
        deletedDate: new Date(),
        updatedAt: new Date()
      }
    }
  );
  
  // Buscar usuário associado à assinatura e atualizar status
  const sub = await db.collection('subscriptions').findOne({ asaasId: subscriptionId });
  if (sub && sub.customerId) {
    await db.collection('customers').updateOne(
      { asaasId: sub.customerId },
      {
        $set: {
          subscriptionStatus: 'INACTIVE',
          updatedAt: new Date()
        }
      }
    );
  }
}

// Adicionar nova função para tratar evento de assinatura criada
async function handleSubscriptionCreated(data, db) {
  console.log('Processando evento SUBSCRIPTION_CREATED');
  
  try {
    // Salvar webhook
    await db.collection('webhooks').insertOne({
      event: 'SUBSCRIPTION_CREATED',
      data: data,
      processedAt: new Date()
    });
    
    const subscription = data.subscription;
    const subscriptionId = subscription.id;
    
    // Atualizar status da assinatura no MongoDB, se existir
    const result = await db.collection('subscriptions').updateOne(
      { asaasId: subscriptionId },
      { 
        $set: { 
          status: 'ACTIVE',
          updatedAt: new Date()
        }
      }
    );
    
    // Se não atualizou nenhum documento, é porque a assinatura ainda não existe no MongoDB
    if (result.matchedCount === 0) {
      console.log(`Assinatura ${subscriptionId} não encontrada no MongoDB. Será criada pelo evento.`);
      
      // Buscar customer pelo customer_id da assinatura
      const customer = await db.collection('customers').findOne({ asaasId: subscription.customer });
      
      if (customer) {
        // Criar assinatura no MongoDB
        await db.collection('subscriptions').insertOne({
          asaasId: subscriptionId,
          customerId: subscription.customer,
          value: subscription.value,
          nextDueDate: subscription.nextDueDate,
          status: subscription.status,
          billingType: subscription.billingType,
          cycle: subscription.cycle,
          description: subscription.description,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // Atualizar customer com status da assinatura
        await db.collection('customers').updateOne(
          { asaasId: subscription.customer },
          {
            $set: {
              subscriptionStatus: 'ACTIVE',
              subscriptionId: subscriptionId,
              updatedAt: new Date()
            }
          }
        );
      } else {
        console.log(`Cliente ${subscription.customer} não encontrado no MongoDB para assinatura ${subscriptionId}`);
      }
    }
    
    console.log(`Evento SUBSCRIPTION_CREATED processado com sucesso para assinatura ${subscriptionId}`);
  } catch (error) {
    console.error('Erro ao processar evento SUBSCRIPTION_CREATED:', error);
  }
} 