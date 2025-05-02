// Endpoint para cancelar assinaturas no Asaas
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
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }

  let client;
  
  try {
    const { subscriptionId } = req.body;

    // Validar campos obrigatórios
    if (!subscriptionId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar o subscriptionId' 
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
      }
    });

    // Verificar se a assinatura existe
    try {
      console.log(`Verificando assinatura: ${subscriptionId}`);
      await apiClient.get(`/subscriptions/${subscriptionId}`);
    } catch (subscriptionError) {
      console.error('Erro ao verificar assinatura:', subscriptionError.message);
      return res.status(404).json({
        success: false,
        error: 'Assinatura não encontrada'
      });
    }

    // Cancelar a assinatura
    console.log(`Cancelando assinatura: ${subscriptionId}`);
    const cancelResponse = await apiClient.delete(`/subscriptions/${subscriptionId}`);
    
    // Se chegou até aqui, o cancelamento foi bem-sucedido
    console.log('Assinatura cancelada com sucesso');

    // Atualizar registro no MongoDB
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        // Atualizar status da assinatura no MongoDB
        await db.collection('subscriptions').updateOne(
          { subscription_id: subscriptionId },
          { 
            $set: { 
              status: 'CANCELLED',
              updated_at: new Date(),
              cancelled_at: new Date()
            }
          }
        );
        
        console.log('Registro da assinatura atualizado no MongoDB');
      } catch (dbError) {
        console.error('Erro ao atualizar registro no MongoDB:', dbError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Assinatura cancelada com sucesso',
      data: {
        subscriptionId,
        status: 'CANCELLED'
      }
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error.message);
    
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
      error: 'Erro ao cancelar assinatura',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 