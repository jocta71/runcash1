// Endpoint para cancelar uma assinatura no Asaas

// Importar módulos necessários
const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configuração para CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  // Obter o ID da assinatura do corpo da requisição
  const { subscriptionId } = req.body;
  
  if (!subscriptionId) {
    return res.status(400).json({ success: false, error: 'ID da assinatura é obrigatório' });
  }

  console.log(`Cancelando assinatura: ${subscriptionId}`);

  let client;
  
  try {
    // Conectar ao MongoDB
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Conexão com MongoDB estabelecida');
    
    const db = client.db();
    const subscriptionsCollection = db.collection('subscriptions');
    const customersCollection = db.collection('customers');
    
    // Verificar se a assinatura existe no banco
    const existingSubscription = await subscriptionsCollection.findOne({ asaas_id: subscriptionId });
    console.log('Assinatura encontrada no MongoDB:', existingSubscription ? 'Sim' : 'Não');
    
    // Cancelar a assinatura no Asaas
    console.log(`Enviando requisição de cancelamento para o Asaas...`);
    
    const asaasResponse = await axios.delete(`${ASAAS_BASE_URL}/subscriptions/${subscriptionId}`, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RunCash/1.0',
        'access_token': ASAAS_API_KEY
      }
    });
    
    console.log('Resposta da API do Asaas:', {
      status: asaasResponse.status,
      statusText: asaasResponse.statusText,
      data: asaasResponse.data
    });
    
    // Atualizar o status no MongoDB
    if (existingSubscription) {
      await subscriptionsCollection.updateOne(
        { asaas_id: subscriptionId },
        { 
          $set: { 
            status: 'CANCELLED',
            deleted: true,
            updated_at: new Date(),
            canceled_at: new Date()
          } 
        }
      );
      console.log('Status da assinatura atualizado no MongoDB');
      
      // Atualizar também o status do cliente
      if (existingSubscription.customer_id) {
        await customersCollection.updateOne(
          { asaas_id: existingSubscription.customer_id },
          {
            $set: {
              subscription_status: 'CANCELLED',
              updated_at: new Date()
            }
          }
        );
        console.log('Status do cliente atualizado no MongoDB');
      }
    }
    
    // Retornar sucesso
    return res.status(200).json({ 
      success: true,
      message: 'Assinatura cancelada com sucesso',
      details: asaasResponse.data
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    
    let errorMessage = 'Erro ao cancelar assinatura';
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