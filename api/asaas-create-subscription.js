import { MongoClient } from 'mongodb';
import axios from 'axios';

const MONGODB_URI = process.env.MONGODB_URI;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENV = process.env.ASAAS_ENV || 'sandbox';

const ASAAS_API_URL = ASAAS_ENV === 'sandbox' 
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3';

export default async function handler(req, res) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Responder imediatamente para requisições OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verificar se é uma requisição POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { planId, userId, customerId, paymentMethod } = req.body;

    if (!planId || !userId || !customerId || !paymentMethod) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Conectar ao MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('runcash');

    // Buscar plano no MongoDB
    const plan = await db.collection('plans').findOne({ id: planId });
    if (!plan) {
      await client.close();
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    // Configurar dados da assinatura
    const subscriptionData = {
      customer: customerId,
      billingType: paymentMethod,
      value: plan.price,
      nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      cycle: 'MONTHLY',
      description: `Assinatura ${plan.name}`,
      maxPayments: null,
      externalReference: userId
    };

    // Criar assinatura no Asaas
    const response = await axios.post(
      `${ASAAS_API_URL}/subscriptions`,
      subscriptionData,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
          'User-Agent': 'RunCash/1.0'
        }
      }
    );

    // Salvar assinatura no MongoDB
    await db.collection('subscriptions').insertOne({
      id: response.data.id,
      userId,
      customerId,
      planId,
      status: response.data.status,
      value: response.data.value,
      billingType: response.data.billingType,
      nextDueDate: response.data.nextDueDate,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await client.close();

    // Retornar dados da assinatura
    return res.status(200).json({
      id: response.data.id,
      status: response.data.status,
      paymentId: response.data.paymentId,
      redirectUrl: response.data.redirectUrl
    });

  } catch (error) {
    console.error('Erro ao criar assinatura:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Erro ao criar assinatura',
      details: error.response?.data || error.message
    });
  }
} 