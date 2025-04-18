const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configurações do ambiente
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

module.exports = async (req, res) => {
  // Configurar CORS para aceitar qualquer origem
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Responder a requisições preflight OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas requisições GET são suportadas
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed', method: req.method });
  }

  // Obter o ID da assinatura da query
  const { subscriptionId } = req.query;

  if (!subscriptionId) {
    return res.status(400).json({ error: 'ID da assinatura não fornecido' });
  }

  let client;

  try {
    // Verificar se a chave de API do Asaas está configurada
    if (!ASAAS_API_KEY) {
      return res.status(500).json({ error: 'API key do Asaas não configurada' });
    }

    console.log(`Buscando informações da assinatura: ${subscriptionId}`);

    // Buscar informações da assinatura no Asaas
    const subscriptionResponse = await axios({
      method: 'get',
      url: `${API_BASE_URL}/subscriptions/${subscriptionId}`,
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });

    // Buscar pagamentos relacionados a esta assinatura
    const paymentsResponse = await axios({
      method: 'get',
      url: `${API_BASE_URL}/payments?subscription=${subscriptionId}`,
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });

    // Conectar ao MongoDB para buscar dados adicionais
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');

    // Buscar registro da assinatura no banco de dados
    const localSubscription = await db.collection('subscriptions').findOne({
      payment_id: subscriptionId
    });

    // Buscar detalhes do plano se estiver disponível
    let planDetails = null;
    if (localSubscription && localSubscription.plan_id) {
      planDetails = await db.collection('plans').findOne({
        id: localSubscription.plan_id
      });
    }

    return res.status(200).json({
      success: true,
      subscription: subscriptionResponse.data,
      payments: paymentsResponse.data.data || [],
      localData: localSubscription || null,
      planDetails: planDetails || null
    });

  } catch (error) {
    console.error('Erro ao buscar dados da assinatura:', error);

    // Verificar se é um erro da API do Asaas
    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: 'Erro ao buscar assinatura no Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({
      error: 'Erro ao processar solicitação',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB se estiver aberta
    if (client) {
      await client.close();
    }
  }
}; 