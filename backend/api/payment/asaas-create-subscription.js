const axios = require('axios');
const { MongoClient } = require('mongodb');
const { protect } = require('../middleware/auth');

// Função principal protegida por autenticação
const createSubscription = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client;

  try {
    const { planId, userId, customerId } = req.body;

    // Validar campos obrigatórios
    if (!planId || !userId || !customerId) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios', 
        details: 'Todos os campos planId, userId e customerId são obrigatórios' 
      });
    }

    // Verificar se o usuário está tentando criar uma assinatura para si mesmo
    if (req.user.id !== userId) {
      console.error(`Tentativa de criar assinatura para outro usuário. Autenticado: ${req.user.id}, Solicitado: ${userId}`);
      return res.status(403).json({ 
        error: 'Acesso negado', 
        details: 'Você só pode criar assinaturas para seu próprio usuário' 
      });
    }

    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');

    // Buscar detalhes do plano no banco de dados
    const planData = await db.collection('plans').findOne({ id: planId });

    if (!planData) {
      console.error('Plano não encontrado:', planId);
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    // Configuração da API do Asaas
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    const API_URL = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!ASAAS_API_KEY) {
      return res.status(500).json({ error: 'Chave de API do Asaas não configurada' });
    }

    // Configuração do cliente HTTP
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    // Para plano gratuito, processar de forma diferente
    if (planId === 'free') {
      // Criar registro de assinatura no MongoDB
      const subscriptionId = `free_${Date.now()}`;
      
      const subscription = await db.collection('subscriptions').insertOne({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        start_date: new Date(),
        payment_platform: 'free',
        payment_id: subscriptionId
      });

      return res.json({
        success: true,
        free: true,
        redirectUrl: '/payment-success?free=true',
        subscriptionId: subscription.insertedId.toString()
      });
    }

    // Calcular dados para a assinatura
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1); // Definir vencimento para o dia seguinte
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

    const cycle = planData.interval === 'monthly' ? 'MONTHLY' : 'YEARLY';
    const value = planData.price;

    // Dados para criar a assinatura no Asaas
    const subscriptionData = {
      customer: customerId,
      billingType: 'PIX',
      value,
      nextDueDate: nextDueDateStr,
      cycle,
      description: `Assinatura ${planData.name} - ${planData.interval}`,
      externalReference: userId,
    };

    // Registrar tentativa de criação de assinatura para auditoria
    await db.collection('subscription_attempts').insertOne({
      user_id: userId,
      plan_id: planId,
      customerId,
      value,
      created_at: new Date(),
      ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    // Criar assinatura no Asaas
    console.log('Criando assinatura no Asaas:', subscriptionData);
    const asaasResponse = await apiClient.post('/subscriptions', subscriptionData);
    const asaasSubscription = asaasResponse.data;
    
    console.log('Assinatura criada no Asaas:', asaasSubscription);

    // Obter o link de pagamento
    const paymentLinkResponse = await apiClient.get(`/subscriptions/${asaasSubscription.id}/paymentLink`);
    const paymentLink = paymentLinkResponse.data;

    // Registrar assinatura no banco de dados
    const dbSubscription = await db.collection('subscriptions').insertOne({
      user_id: userId,
      plan_id: planId,
      status: 'pending',
      subscription_id: asaasSubscription.id,
      payment_id: asaasSubscription.id,
      payment_platform: 'asaas',
      value,
      cycle,
      created_at: new Date(),
      next_due_date: new Date(nextDueDateStr)
    });

    // Retornar dados para o cliente
    return res.json({
      success: true,
      subscriptionId: asaasSubscription.id,
      paymentLink: paymentLink.url,
      status: asaasSubscription.status
    });
  } catch (error) {
    console.error('Erro ao criar assinatura:', error.message);
    return res.status(500).json({ error: 'Erro ao criar assinatura', details: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
};

// Exportar o middleware de proteção juntamente com o handler
module.exports = [protect, createSubscription];