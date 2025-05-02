// Endpoint para verificar o status de um pagamento no Asaas
const axios = require('axios');
const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }
  
  // Registrar timestamp para medição de performance
  const startTime = Date.now();

  try {
    // Obter paymentId da query
    const { paymentId } = req.query;

    if (!paymentId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar o ID do pagamento' 
      });
    }

    // Configuração da API do Asaas
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    const API_URL = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!ASAAS_API_KEY) {
      return res.status(500).json({ 
        success: false,
        error: 'Chave de API do Asaas não configurada' 
      });
    }

    // Configuração do cliente HTTP
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 5000 // Timeout mais curto para verificações de status
    });

    // Consultar status do pagamento
    console.log(`Verificando status do pagamento ${paymentId}...`);
    const paymentResponse = await apiClient.get(`/payments/${paymentId}`);
    const payment = paymentResponse.data;
    
    console.log(`Status do pagamento ${paymentId}: ${payment.status}`);
    
    // Registrar no MongoDB, se configurado
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        // Registrar log da verificação
        await db.collection('payment_status_checks').insertOne({
          payment_id: paymentId,
          status: payment.status,
          timestamp: new Date(),
          processing_time_ms: Date.now() - startTime
        });
        
        // Se o pagamento foi confirmado, atualizar também na collection de pagamentos
        if (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED') {
          await db.collection('payments').updateOne(
            { payment_id: paymentId },
            { 
              $set: { 
                status: payment.status,
                confirmed_at: new Date()
              },
              $push: {
                status_history: {
                  status: payment.status,
                  timestamp: new Date()
                }
              }
            },
            { upsert: true }
          );
        }
        
        await client.close();
      } catch (dbError) {
        console.error('Erro ao registrar verificação no MongoDB:', dbError.message);
        // Não falhamos a request se o log falhar
      }
    }
    
    // Retornar dados do pagamento, com informações relevantes
    return res.status(200).json({
      success: true,
      id: payment.id,
      status: payment.status,
      value: payment.value,
      netValue: payment.netValue,
      description: payment.description,
      billingType: payment.billingType,
      confirmedDate: payment.confirmedDate,
      customer: payment.customer,
      subscription: payment.subscription,
      processingTime: Date.now() - startTime
    });
  } catch (error) {
    console.error('Erro ao verificar status do pagamento:', error.message);
    
    // Verificar se o erro é da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar status do pagamento',
      message: error.message
    });
  }
}; 