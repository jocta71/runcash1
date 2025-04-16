// Endpoint para listar assinaturas de um cliente no Asaas
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

  // Verificar se o método é GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Método não permitido',
      message: 'Apenas requisições GET são permitidas para este endpoint'
    });
  }

  const customerId = req.query.customerId;

  // Verificar se o ID do cliente foi fornecido
  if (!customerId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Dados incompletos',
      message: 'ID do cliente é obrigatório' 
    });
  }

  console.log(`=== INÍCIO DA LISTAGEM DE ASSINATURAS ===`);
  console.log(`Método: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Cliente ID: ${customerId}`);

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

    // Fazer requisição para o Asaas
    console.log(`=== REQUISIÇÃO PARA O ASAAS ===`);
    console.log(`URL: ${ASAAS_BASE_URL}/subscriptions?customer=${customerId}`);
    console.log(`Método: GET`);

    const response = await axios.get(
      `${ASAAS_BASE_URL}/subscriptions?customer=${customerId}`,
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
    console.log(`Dados: ${JSON.stringify(response.data.data ? 
      `${response.data.data.length} assinaturas encontradas` : 
      'Nenhuma assinatura encontrada')}`);

    // Salvar resultado no MongoDB para auditoria
    const db = client.db();
    await db.collection('api_logs').insertOne({
      endpoint: 'asaas-list-subscriptions',
      requestData: { customerId },
      responseStatus: response.status,
      responseData: `${response.data.data ? response.data.data.length : 0} assinaturas encontradas`,
      timestamp: new Date()
    });

    // Retornar os dados das assinaturas
    return res.status(200).json({
      success: true,
      data: response.data.data || []
    });

  } catch (error) {
    console.error('=== ERRO AO LISTAR ASSINATURAS ===');
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
          endpoint: 'asaas-list-subscriptions',
          error: error.message,
          customerId,
          date: new Date()
        });
      } catch (dbError) {
        console.error('Erro ao salvar erro no banco:', dbError);
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao listar assinaturas',
      message: error.message
    });
  } finally {
    if (client) {
      console.log('Fechando conexão com MongoDB');
      await client.close();
    }
    console.log(`=== FIM DA LISTAGEM DE ASSINATURAS ===`);
  }
}; 