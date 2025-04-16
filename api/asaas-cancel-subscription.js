// Endpoint para cancelar uma assinatura no Asaas
const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

// Configuração do Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
const ASAAS_BASE_URL = ASAAS_ENVIRONMENT === 'sandbox' 
  ? 'https://sandbox.asaas.com/api/v3' 
  : 'https://api.asaas.com/v3';

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Responder à requisição OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar se o método é POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Método não permitido',
      message: 'Apenas requisições POST são permitidas para este endpoint'
    });
  }

  // Extrair ID da assinatura do corpo da requisição
  const { subscriptionId } = req.body || {};

  // Verificar se o ID da assinatura foi fornecido
  if (!subscriptionId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Dados incompletos',
      message: 'ID da assinatura é obrigatório' 
    });
  }

  console.log(`=== INÍCIO DO CANCELAMENTO DE ASSINATURA ===`);
  console.log(`Método: ${req.method}`);
  console.log(`Assinatura ID: ${subscriptionId}`);

  // Cliente MongoDB
  let client;
  
  try {
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Conexão com MongoDB estabelecida');

    // Configuração do Asaas
    console.log(`Usando ambiente Asaas: ${ASAAS_ENVIRONMENT}`);
    const apiConfig = {
      baseUrl: ASAAS_BASE_URL,
      apiKey: ASAAS_API_KEY,
      environment: ASAAS_ENVIRONMENT,
      nodeEnv: process.env.NODE_ENV
    };
    console.log('Configuração do Asaas:', {
      baseUrl: apiConfig.baseUrl,
      apiKey: ASAAS_API_KEY ? `${ASAAS_API_KEY.substring(0, 8)}...` : 'Não configurado',
      environment: apiConfig.environment,
      nodeEnv: apiConfig.nodeEnv
    });

    // Fazer requisição para o Asaas para cancelar a assinatura
    console.log(`=== REQUISIÇÃO PARA O ASAAS (CANCELAR ASSINATURA) ===`);
    console.log(`URL: ${ASAAS_BASE_URL}/subscriptions/${subscriptionId}/cancel`);
    console.log(`Método: POST`);

    const response = await axios.post(
      `${ASAAS_BASE_URL}/subscriptions/${subscriptionId}/cancel`,
      {}, // corpo vazio conforme documentação do Asaas
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': ASAAS_API_KEY
        }
      }
    );

    // Log da resposta
    console.log(`=== RESPOSTA DO ASAAS ===`);
    console.log(`Status: ${response.status}`);
    console.log(`Dados: ${JSON.stringify(response.data)}`);

    // Salvar resultado no MongoDB
    const db = client.db();
    
    // Atualizar status da assinatura no banco
    await db.collection('subscriptions').updateOne(
      { asaasId: subscriptionId },
      { 
        $set: { 
          status: 'CANCELLED',
          canceledAt: new Date()
        } 
      },
      { upsert: false }
    );
    
    // Registrar operação nos logs
    await db.collection('api_logs').insertOne({
      endpoint: 'asaas-cancel-subscription',
      requestData: { subscriptionId },
      responseStatus: response.status,
      responseData: response.data,
      timestamp: new Date()
    });

    // Retornar sucesso
    return res.status(200).json({
      success: true,
      message: 'Assinatura cancelada com sucesso',
      data: response.data
    });

  } catch (error) {
    console.error('=== ERRO AO CANCELAR ASSINATURA ===');
    console.error(`Mensagem: ${error.message}`);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Dados: ${JSON.stringify(error.response.data)}`);
    }

    // Log do erro
    if (client && client.topology && client.topology.isConnected()) {
      try {
        const db = client.db();
        await db.collection('errors').insertOne({
          endpoint: 'asaas-cancel-subscription',
          error: error.message,
          subscriptionId,
          date: new Date()
        });
      } catch (dbError) {
        console.error('Erro ao salvar erro no banco:', dbError);
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao cancelar assinatura',
      message: error.message
    });
  } finally {
    if (client) {
      console.log('Fechando conexão com MongoDB');
      await client.close();
    }
    console.log(`=== FIM DO CANCELAMENTO DE ASSINATURA ===`);
  }
}; 