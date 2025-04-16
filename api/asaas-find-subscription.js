// Endpoint para buscar detalhes de uma assinatura no Asaas

// Importar módulos necessários
const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configuração para CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// URL de conexão com MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('MONGODB_URI não configurado');

// Configuração do Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const ASAAS_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://api.asaas.com/v3' 
  : 'https://sandbox.asaas.com/api/v3';

// Função principal do endpoint
module.exports = async (req, res) => {
  // Configurar headers CORS para todas as respostas
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  // Verificar se é um preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validar método HTTP
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  // Obter o ID da assinatura da query string
  const { subscriptionId } = req.query;
  
  if (!subscriptionId) {
    return res.status(400).json({ success: false, error: 'ID da assinatura é obrigatório' });
  }

  console.log(`Buscando detalhes da assinatura: ${subscriptionId}`);

  let client;
  
  try {
    // Conectar ao MongoDB
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Conexão com MongoDB estabelecida');
    
    const db = client.db();
    const subscriptionsCollection = db.collection('subscriptions');
    
    // Tentar buscar do cache primeiro
    const cachedSubscription = await subscriptionsCollection.findOne({ id: subscriptionId });
    
    // Buscar os dados mais recentes do Asaas
    console.log(`Consultando a API do Asaas para a assinatura ${subscriptionId}...`);
    
    const asaasResponse = await axios.get(`${ASAAS_BASE_URL}/subscriptions/${subscriptionId}`, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RunCash/1.0',
        'access_token': ASAAS_API_KEY
      }
    });
    
    console.log('Resposta da API do Asaas:', {
      status: asaasResponse.status,
      statusText: asaasResponse.statusText
    });
    
    const subscription = asaasResponse.data;
    
    // Atualizar ou inserir no MongoDB
    if (subscription && subscription.id) {
      await subscriptionsCollection.updateOne(
        { id: subscription.id },
        { $set: { ...subscription, updatedAt: new Date() } },
        { upsert: true }
      );
    }
    
    // Buscar os pagamentos relacionados a esta assinatura
    const paymentsResponse = await axios.get(`${ASAAS_BASE_URL}/subscriptions/${subscriptionId}/payments`, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RunCash/1.0',
        'access_token': ASAAS_API_KEY
      }
    });
    
    // Adicionar os pagamentos ao objeto de retorno
    const paymentsData = paymentsResponse.data;
    const payments = paymentsData.data || [];
    
    // Retornar os dados da assinatura
    return res.status(200).json({ 
      success: true,
      subscription,
      payments,
      cacheData: cachedSubscription || null
    });
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error);
    
    let errorMessage = 'Erro ao buscar detalhes da assinatura';
    let statusCode = 500;
    
    if (error.response) {
      // Erro da API do Asaas
      statusCode = error.response.status;
      errorMessage = `Erro na API do Asaas: ${statusCode} - ${JSON.stringify(error.response.data)}`;
      console.error('Detalhes do erro da API:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      // Erro na requisição (sem resposta)
      errorMessage = 'Sem resposta da API do Asaas';
      console.error('Sem resposta da API:', error.request);
    } else {
      // Outros erros
      errorMessage = error.message;
    }
    
    return res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      details: error.message
    });
  } finally {
    // Fechar conexão com MongoDB
    if (client) {
      await client.close();
      console.log('Conexão com MongoDB fechada');
    }
  }
}; 