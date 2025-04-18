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

  const { paymentId } = req.query;

  if (!paymentId) {
    return res.status(400).json({ error: 'ID do pagamento não fornecido' });
  }

  let client;

  try {
    // Verificar se a chave de API do Asaas está configurada
    if (!ASAAS_API_KEY) {
      return res.status(500).json({ error: 'API key do Asaas não configurada' });
    }

    console.log(`Buscando informações do pagamento: ${paymentId}`);

    // Buscar informações do pagamento no Asaas
    const response = await axios({
      method: 'get',
      url: `${API_BASE_URL}/payments/${paymentId}`,
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });

    const paymentData = response.data;

    // Se a requisição for especificamente para dados de QR Code PIX, buscar essas informações
    if (req.query.pix === 'true' || req.query.qrcode === 'true') {
      try {
        const pixResponse = await axios({
          method: 'get',
          url: `${API_BASE_URL}/payments/${paymentId}/pixQrCode`,
          headers: {
            'access_token': ASAAS_API_KEY
          }
        });

        return res.status(200).json({
          success: true,
          payment: paymentData,
          pix: pixResponse.data
        });
      } catch (pixError) {
        console.error('Erro ao buscar dados do PIX:', pixError.message);
        return res.status(200).json({
          success: true,
          payment: paymentData,
          pix: null,
          pixError: 'Não foi possível obter dados do PIX'
        });
      }
    }

    // Conectar ao MongoDB para buscar dados adicionais se necessário
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');

    // Buscar registro da assinatura/pagamento no banco de dados
    let paymentRecord = null;
    if (paymentData.subscription) {
      // Se for um pagamento de assinatura, buscar dados da assinatura
      paymentRecord = await db.collection('subscriptions').findOne({
        payment_id: paymentData.subscription
      });
    } else {
      // Caso contrário, buscar dados do pagamento avulso
      paymentRecord = await db.collection('payments').findOne({
        payment_id: paymentId
      });
    }

    return res.status(200).json({
      success: true,
      payment: paymentData,
      localData: paymentRecord || null
    });

  } catch (error) {
    console.error('Erro ao buscar dados do pagamento:', error);

    // Verificar se é um erro da API do Asaas
    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: 'Erro ao buscar pagamento no Asaas',
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