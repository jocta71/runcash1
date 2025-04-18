// Endpoint para gerar QR code PIX para pagamentos no Asaas
const axios = require('axios');

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

  // Aceitar solicitações GET e POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }
  
  try {
    // Obter ID do pagamento da query (GET) ou body (POST)
    let paymentId;
    
    if (req.method === 'GET') {
      paymentId = req.query.paymentId;
    } else {
      paymentId = req.body.paymentId;
    }

    // Validar campos obrigatórios
    if (!paymentId) {
      return res.status(400).json({ 
        success: false,
        error: 'Campo obrigatório: paymentId' 
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

    // Verificar se o pagamento existe e é do tipo PIX
    console.log(`Verificando pagamento: ${paymentId}`);
    const paymentResponse = await apiClient.get(`/payments/${paymentId}`);
    const payment = paymentResponse.data;
    
    if (payment.billingType !== 'PIX') {
      return res.status(400).json({
        success: false,
        error: 'O pagamento não é do tipo PIX'
      });
    }
    
    // Gerar QR code PIX
    console.log(`Gerando QR code PIX para o pagamento: ${paymentId}`);
    const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
    
    // Extrair dados do QR code
    const qrCode = {
      encodedImage: pixResponse.data.encodedImage,
      payload: pixResponse.data.payload,
      expirationDate: pixResponse.data.expirationDate
    };
    
    // Informações adicionais do pagamento
    const paymentInfo = {
      id: payment.id,
      value: payment.value,
      status: payment.status,
      dueDate: payment.dueDate,
      description: payment.description
    };
    
    // Retornar resposta com QR code e dados do pagamento
    return res.status(200).json({
      success: true,
      qrCode,
      payment: paymentInfo
    });
  } catch (error) {
    console.error('Erro ao gerar QR code PIX:', error.message);
    
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
      error: 'Erro ao gerar QR code PIX',
      message: error.message
    });
  }
}; 