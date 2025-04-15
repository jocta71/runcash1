const axios = require('axios');
const { MongoClient } = require('mongodb');

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

    // Criar assinatura no Asaas
    console.log('Criando assinatura no Asaas:', subscriptionData);
    const asaasResponse = await apiClient.post('/subscriptions', subscriptionData);
    const asaasSubscription = asaasResponse.data;
    
    console.log('Assinatura criada no Asaas:', asaasSubscription);

    // Obter o link de pagamento
    const paymentLinkResponse = await apiClient.get(`/subscriptions/${asaasSubscription.id}/paymentLink`);
    const paymentLink = paymentLinkResponse.data.url;

    // Registrar assinatura no MongoDB
    const dbSubscription = await db.collection('subscriptions').insertOne({
      user_id: userId,
      plan_id: planId,
      status: 'pending',
      payment_platform: 'asaas',
      payment_id: asaasSubscription.id,
      start_date: new Date(),
      payment_data: JSON.stringify(asaasSubscription)
    });

    return res.json({
      success: true,
      subscriptionId: asaasSubscription.id,
      redirectUrl: paymentLink,
      internalId: dbSubscription.insertedId.toString()
    });
  } catch (error) {
    console.error('Erro ao processar solicitação:', error);
    
    // Verificar se o erro é da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({
      error: 'Erro ao processar solicitação',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
};