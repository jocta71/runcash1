const axios = require('axios');
const { MongoClient } = require('mongodb');

// MongoDB Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'runcashh';

// Asaas API Configuration
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://www.asaas.com/api/v3' 
  : 'https://sandbox.asaas.com/api/v3';

// CORS Headers Configuration
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
  
  console.log('[Subscription] Requisição recebida');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body));
  
  // Check if request method is POST
  if (req.method !== 'POST') {
    console.log('[Subscription] Método não suportado:', req.method);
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  // Check for required data
  const { customerId, planId, value } = req.body;
  if (!customerId || !planId || !value) {
    console.log('[Subscription] Dados obrigatórios ausentes');
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['customerId', 'planId', 'value'],
      received: req.body
    });
  }
  
  // Validate API key
  if (!ASAAS_API_KEY) {
    console.error('[Subscription] Chave de API Asaas não configurada');
    return res.status(500).json({ error: 'Asaas API key is not configured' });
  }
  
  console.log('[Subscription] ASAAS_API_URL:', ASAAS_API_URL);
  console.log('[Subscription] ASAAS_API_KEY (primeiros 4 chars):', ASAAS_API_KEY.substring(0, 4));
  
  let client;
  
  try {
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('[Subscription] Conectado ao MongoDB');
    
    const db = client.db(DB_NAME);
    const subscriptionsCollection = db.collection('subscriptions');
    const customersCollection = db.collection('customers');
    const plansCollection = db.collection('plans');
    
    // Get customer from MongoDB
    const customer = await customersCollection.findOne({ 
      asaasCustomerId: customerId 
    });
    
    if (!customer) {
      console.log('[Subscription] Cliente não encontrado no MongoDB:', customerId);
    } else {
      console.log('[Subscription] Cliente encontrado no MongoDB:', customer._id);
    }
    
    // Get plan from MongoDB
    const plan = await plansCollection.findOne({ _id: planId });
    
    if (!plan) {
      console.log('[Subscription] Plano não encontrado no MongoDB:', planId);
    } else {
      console.log('[Subscription] Plano encontrado no MongoDB:', plan._id);
    }
    
    // Create subscription in Asaas
    console.log('[Subscription] Criando assinatura no Asaas para cliente:', customerId);
    
    const today = new Date();
    const nextDueDate = today.toISOString().split('T')[0];
    
    const createResponse = await axios.post(
      `${ASAAS_API_URL}/subscriptions`,
      {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: parseFloat(value),
        nextDueDate,
        cycle: 'MONTHLY',
        description: `Assinatura ${plan?.name || 'Plano RunCashh'}`,
        creditCard: req.body.creditCard,
        creditCardHolderInfo: req.body.creditCardHolderInfo,
        remoteIp: req.body.remoteIp || req.headers['x-forwarded-for'] || req.socket.remoteAddress
      },
      {
        headers: {
          'access_token': ASAAS_API_KEY,
          'User-Agent': 'RunCash/1.0',
          'Content-Type': 'application/json'
        }
      }
    );
    
    const asaasSubscription = createResponse.data;
    console.log('[Subscription] Assinatura criada no Asaas:', asaasSubscription.id);
    
    // Save subscription to MongoDB
    const newSubscription = {
      asaasSubscriptionId: asaasSubscription.id,
      customerId: customer?._id || null,
      asaasCustomerId: customerId,
      planId: plan?._id || planId,
      value: parseFloat(value),
      status: asaasSubscription.status,
      nextDueDate: new Date(nextDueDate),
      cycle: 'MONTHLY',
      description: `Assinatura ${plan?.name || 'Plano RunCashh'}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const insertResult = await subscriptionsCollection.insertOne(newSubscription);
    console.log('[Subscription] Assinatura salva no MongoDB:', insertResult.insertedId);
    
    return res.status(201).json({
      success: true,
      subscription: {
        id: asaasSubscription.id,
        status: asaasSubscription.status,
        value: asaasSubscription.value,
        nextDueDate: asaasSubscription.nextDueDate,
        description: asaasSubscription.description
      },
      message: 'Subscription created successfully'
    });
    
  } catch (error) {
    console.error('[Subscription] Erro:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Unauthorized access to Asaas API',
        message: 'Check your API key configuration'
      });
    }
    
    return res.status(500).json({
      error: 'Failed to create subscription',
      message: error.response?.data?.errors?.[0]?.description || error.message
    });
  } finally {
    // Close MongoDB connection
    if (client) {
      await client.close();
      console.log('[Subscription] Conexão MongoDB fechada');
    }
  }
};