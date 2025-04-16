// Endpoint para simular falhas de pagamento no Asaas
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

  // Extrair dados da requisição
  const { paymentId, reason } = req.body || {};

  // Verificar se os dados necessários foram fornecidos
  if (!paymentId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Dados incompletos',
      message: 'ID do pagamento é obrigatório' 
    });
  }

  if (!reason) {
    return res.status(400).json({ 
      success: false, 
      error: 'Dados incompletos',
      message: 'Motivo da falha é obrigatório' 
    });
  }

  // Validar o motivo da falha
  const allowedReasons = ['INSUFFICIENT_FUNDS', 'CREDIT_CARD_EXPIRED', 'TRANSACTION_DECLINED', 'PROCESSING_ERROR'];
  if (!allowedReasons.includes(reason)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Motivo inválido',
      message: `Motivo da falha deve ser um dos seguintes: ${allowedReasons.join(', ')}` 
    });
  }

  console.log(`=== INÍCIO DA SIMULAÇÃO DE FALHA DE PAGAMENTO ===`);
  console.log(`Método: ${req.method}`);
  console.log(`Pagamento ID: ${paymentId}`);
  console.log(`Motivo: ${reason}`);

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

    // Primeiro, precisamos obter informações sobre o pagamento
    console.log(`=== REQUISIÇÃO PARA O ASAAS (OBTER PAGAMENTO) ===`);
    console.log(`URL: ${ASAAS_BASE_URL}/payments/${paymentId}`);
    console.log(`Método: GET`);

    const paymentResponse = await axios.get(
      `${ASAAS_BASE_URL}/payments/${paymentId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': ASAAS_API_KEY
        }
      }
    );

    console.log(`Dados do pagamento obtidos: ${JSON.stringify(paymentResponse.data)}`);
    
    // No ambiente sandbox do Asaas, não é possível simular falhas diretamente via API
    // Vamos cancelar o pagamento e registrar o motivo para simular uma falha
    
    // Cancelar o pagamento atual
    console.log(`=== REQUISIÇÃO PARA O ASAAS (CANCELAR PAGAMENTO) ===`);
    console.log(`URL: ${ASAAS_BASE_URL}/payments/${paymentId}`);
    console.log(`Método: DELETE`);

    const deleteResponse = await axios.delete(
      `${ASAAS_BASE_URL}/payments/${paymentId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': ASAAS_API_KEY
        }
      }
    );

    console.log(`Resposta do cancelamento: ${JSON.stringify(deleteResponse.data)}`);

    // Salvar resultado no MongoDB
    const db = client.db();
    
    // Atualizar status do pagamento no banco
    await db.collection('payments').updateOne(
      { paymentId },
      { 
        $set: { 
          status: 'FAILED',
          failureReason: reason,
          failureAt: new Date(),
          originalPaymentData: paymentResponse.data
        } 
      },
      { upsert: true }
    );
    
    // Registrar operação nos logs
    await db.collection('api_logs').insertOne({
      endpoint: 'asaas-simulate-failure',
      requestData: { paymentId, reason },
      responseStatus: deleteResponse.status,
      responseData: deleteResponse.data,
      timestamp: new Date()
    });

    // Retornar sucesso
    return res.status(200).json({
      success: true,
      message: `Falha de pagamento simulada com sucesso: ${reason}`,
      data: {
        paymentId,
        status: 'FAILED',
        failureReason: reason
      }
    });

  } catch (error) {
    console.error('=== ERRO AO SIMULAR FALHA DE PAGAMENTO ===');
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
          endpoint: 'asaas-simulate-failure',
          error: error.message,
          paymentId,
          reason,
          date: new Date()
        });
      } catch (dbError) {
        console.error('Erro ao salvar erro no banco:', dbError);
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao simular falha de pagamento',
      message: error.message
    });
  } finally {
    if (client) {
      console.log('Fechando conexão com MongoDB');
      await client.close();
    }
    console.log(`=== FIM DA SIMULAÇÃO DE FALHA DE PAGAMENTO ===`);
  }
}; 