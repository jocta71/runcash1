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

  // Apenas requisições POST são suportadas
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', method: req.method });
  }

  // Obter o ID da assinatura do corpo da requisição
  const { subscriptionId } = req.body;

  if (!subscriptionId) {
    return res.status(400).json({ error: 'ID da assinatura não fornecido' });
  }

  let client;

  try {
    // Verificar se a chave de API do Asaas está configurada
    if (!ASAAS_API_KEY) {
      return res.status(500).json({ error: 'API key do Asaas não configurada' });
    }

    console.log(`Cancelando assinatura: ${subscriptionId}`);

    // Cancelar a assinatura no Asaas
    const response = await axios({
      method: 'delete',
      url: `${API_BASE_URL}/subscriptions/${subscriptionId}`,
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });

    // Conectar ao MongoDB para atualizar os dados locais
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');

    // Buscar o registro da assinatura no banco de dados
    const subscription = await db.collection('subscriptions').findOne({
      payment_id: subscriptionId
    });

    if (subscription) {
      // Atualizar o status da assinatura no banco de dados
      await db.collection('subscriptions').updateOne(
        { payment_id: subscriptionId },
        { 
          $set: { 
            status: 'canceled',
            end_date: new Date(),
            updated_at: new Date()
          } 
        }
      );
      
      // Adicionar uma notificação para o usuário
      await db.collection('notifications').insertOne({
        user_id: subscription.user_id,
        title: 'Assinatura cancelada',
        message: 'Sua assinatura foi cancelada conforme solicitado.',
        type: 'info',
        read: false,
        created_at: new Date()
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Assinatura cancelada com sucesso',
      data: response.data
    });

  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);

    // Verificar se é um erro da API do Asaas
    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: 'Erro ao cancelar assinatura no Asaas',
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