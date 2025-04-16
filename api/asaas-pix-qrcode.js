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

  // Verificar método da requisição
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter o ID do pagamento da query
    const { paymentId } = req.query;

    console.log('=== REQUISIÇÃO PARA GERAR QR CODE PIX ===');
    console.log('Método:', req.method);
    console.log('URL:', req.url);
    console.log('Query:', req.query);
    console.log('PaymentId:', paymentId);

    if (!paymentId) {
      return res.status(400).json({ 
        error: 'Parâmetro ausente', 
        details: 'ID do pagamento é obrigatório' 
      });
    }

    // Forçar uso do sandbox enquanto estamos em teste
    const ASAAS_ENVIRONMENT = 'sandbox';
    console.log(`Usando ambiente Asaas: ${ASAAS_ENVIRONMENT}`);
    
    // Configurar chamada para API do Asaas
    const asaasBaseUrl = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
    const asaasApiKey = process.env.ASAAS_API_KEY;

    console.log('Configuração do Asaas:', {
      baseUrl: asaasBaseUrl,
      apiKey: asaasApiKey ? `${asaasApiKey.substring(0, 10)}...` : 'não definido'
    });

    if (!asaasApiKey) {
      throw new Error('Chave da API do Asaas não configurada');
    }

    console.log('Fazendo requisição para o Asaas:', {
      url: `${asaasBaseUrl}/payments/${paymentId}/pixQrCode`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RunCash/1.0',
        'access_token': `${asaasApiKey.substring(0, 10)}...`
      }
    });

    // Obter QR code do pagamento
    const response = await axios.get(
      `${asaasBaseUrl}/payments/${paymentId}/pixQrCode`,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': asaasApiKey
        },
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      }
    );

    console.log('Resposta do Asaas:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: typeof response.data === 'object' ? response.data : 'Resposta não é JSON'
    });

    // Verificar se a resposta foi bem sucedida
    if (response.status !== 200) {
      console.error('Erro na resposta do Asaas:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
      return res.status(response.status).json({ 
        error: 'Erro ao obter QR code PIX na API do Asaas',
        details: response.data
      });
    }

    // Verificar se a resposta contém os dados do QR code
    if (!response.data || !response.data.encodedImage) {
      return res.status(404).json({ 
        error: 'QR Code não encontrado',
        details: 'Não foi possível obter o QR code para este pagamento'
      });
    }

    // Retornar os dados do QR code
    return res.status(200).json({
      success: true,
      paymentId: paymentId,
      qrCodeImage: response.data.encodedImage,
      qrCodeText: response.data.payload,
      expirationDate: response.data.expirationDate
    });
  } catch (error) {
    console.error('Erro ao obter QR code PIX:', error);
    
    // Tratar erros específicos da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({ 
      error: 'Erro ao obter QR code PIX',
      message: error.message 
    });
  }
}; 