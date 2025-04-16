import { MongoClient } from 'mongodb';
import axios from 'axios';

const MONGODB_URI = process.env.MONGODB_URI;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.asaas.com/v3' 
  : 'https://sandbox.asaas.com/api/v3';

export default async function handler(req, res) {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { 
    customerId, 
    planId,
    billingType = 'PIX',
    nextDueDate,
    value,
    cycle = 'MONTHLY',
    description,
    creditCardToken,
    creditCard,
    userEmail,
    userName,
    holderName,
    cardNumber,
    expiryMonth,
    expiryYear,
    ccv,
    holderEmail,
    holderCpfCnpj,
    holderPostalCode,
    holderAddressNumber,
    holderPhone
  } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'ID do cliente é obrigatório' });
  }

  if (!planId) {
    return res.status(400).json({ error: 'ID do plano é obrigatório' });
  }

  if (!value) {
    return res.status(400).json({ error: 'Valor é obrigatório' });
  }

  // Configurar cliente MongoDB
  let client;
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    const plansCollection = db.collection('plans');

    // Buscar informações do plano
    const plan = await plansCollection.findOne({ _id: planId });
    if (!plan) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    // Configurar chamada para API Asaas
    const asaasConfig = {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RunCash/1.0',
        'access_token': ASAAS_API_KEY
      }
    };

    // Dados da assinatura
    const subscriptionData = {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: value,
      nextDueDate: nextDueDate,
      cycle: cycle,
      description: `Assinatura do plano ${planId}`,
      creditCard: {
        holderName,
        number: cardNumber.replace(/[^\d]/g, ''),
        expiryMonth: expiryMonth,
        expiryYear: expiryYear,
        ccv
      },
      creditCardHolderInfo: {
        name: holderName,
        email: holderEmail,
        cpfCnpj: holderCpfCnpj.replace(/[^\d]/g, ''),
        postalCode: holderPostalCode.replace(/[^\d]/g, ''),
        addressNumber: holderAddressNumber,
        phone: holderPhone.replace(/[^\d]/g, '')
      }
    };

    // Criar assinatura no Asaas
    const response = await axios.post(
      `${ASAAS_API_URL}/subscriptions`,
      subscriptionData,
      asaasConfig
    );

    // Salvar detalhes da assinatura no MongoDB
    const subscriptionsCollection = db.collection('subscriptions');
    const customerCollection = db.collection('customers');
    
    // Buscar ou atualizar informações do cliente
    let customer = await customerCollection.findOne({ asaasId: customerId });
    
    if (!customer && userEmail) {
      customer = {
        asaasId: customerId,
        email: userEmail,
        name: userName,
        createdAt: new Date()
      };
      await customerCollection.insertOne(customer);
    }
    
    // Salvar assinatura
    const subscription = {
      asaasId: response.data.id,
      customerId: customerId,
      planId: planId,
      value: value,
      status: response.data.status,
      nextDueDate: response.data.nextDueDate,
      cycle: cycle,
      billingType: billingType,
      description: subscriptionData.description,
      createdAt: new Date()
    };
    
    await subscriptionsCollection.insertOne(subscription);

    return res.status(201).json({
      success: true,
      subscription: response.data,
      localSubscription: subscription
    });
  } catch (error) {
    console.error('Erro ao criar assinatura:', error.response?.data || error.message);
    
    return res.status(error.response?.status || 500).json({
      error: 'Erro ao criar assinatura',
      details: error.response?.data || error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
} 