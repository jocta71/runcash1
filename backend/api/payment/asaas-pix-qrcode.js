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

  try {
    // Verificar se a chave de API do Asaas está configurada
    if (!ASAAS_API_KEY) {
      return res.status(500).json({ error: 'API key do Asaas não configurada' });
    }

    console.log(`Buscando dados do QR Code PIX para o pagamento: ${paymentId}`);

    // Buscar informações do PIX QR Code no Asaas
    const response = await axios({
      method: 'get',
      url: `${API_BASE_URL}/payments/${paymentId}/pixQrCode`,
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });

    // Também buscar dados básicos do pagamento
    const paymentResponse = await axios({
      method: 'get',
      url: `${API_BASE_URL}/payments/${paymentId}`,
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });

    return res.status(200).json({
      success: true,
      payment: paymentResponse.data,
      pix: response.data,
      encodedImage: response.data.encodedImage,
      payload: response.data.payload,
      expirationDate: response.data.expirationDate
    });

  } catch (error) {
    console.error('Erro ao buscar QR Code PIX:', error);

    // Verificar se é um erro da API do Asaas
    if (error.response) {
      // Se o código de erro for 404, provavelmente o pagamento não é do tipo PIX
      if (error.response.status === 404) {
        return res.status(400).json({
          error: 'QR Code PIX não disponível',
          details: 'Este pagamento não possui QR Code PIX. Verifique se o método de pagamento é PIX.'
        });
      }

      return res.status(error.response.status || 500).json({
        error: 'Erro ao buscar QR Code PIX no Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({
      error: 'Erro ao processar solicitação',
      message: error.message
    });
  }
}; 