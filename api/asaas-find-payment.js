// Endpoint para buscar informações de pagamento no Asaas
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

  // Apenas aceitar solicitações GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  try {
    const { paymentId, subscriptionId, customerId } = req.query;

    // Validar campos obrigatórios
    if (!paymentId && !subscriptionId && !customerId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar paymentId, subscriptionId ou customerId' 
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

    let paymentsData = [];
    let qrCode = null;

    // Buscar pagamento específico ou lista de pagamentos
    if (paymentId) {
      console.log(`Buscando pagamento específico: ${paymentId}`);
      const paymentResponse = await apiClient.get(`/payments/${paymentId}`);
      paymentsData = [paymentResponse.data];
      
      // Se o pagamento for PIX, buscar QR Code
      if (paymentResponse.data.billingType === 'PIX') {
        try {
          const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
          qrCode = {
            encodedImage: pixResponse.data.encodedImage,
            payload: pixResponse.data.payload
          };
        } catch (pixError) {
          console.error('Erro ao obter QR Code PIX:', pixError.message);
        }
      }
    } else if (subscriptionId) {
      console.log(`Buscando pagamentos da assinatura: ${subscriptionId}`);
      const paymentsResponse = await apiClient.get('/payments', {
        params: { subscription: subscriptionId }
      });
      paymentsData = paymentsResponse.data.data || [];
    } else if (customerId) {
      console.log(`Buscando pagamentos do cliente: ${customerId}`);
      const paymentsResponse = await apiClient.get('/payments', {
        params: { customer: customerId }
      });
      paymentsData = paymentsResponse.data.data || [];
    }

    // Formatar resposta
    const formattedPayments = paymentsData.map(payment => ({
      id: payment.id,
      status: payment.status,
      value: payment.value,
      netValue: payment.netValue,
      billingType: payment.billingType,
      dueDate: payment.dueDate,
      paymentDate: payment.paymentDate,
      description: payment.description,
      invoiceUrl: payment.invoiceUrl,
      externalReference: payment.externalReference,
      subscription: payment.subscription,
      customer: payment.customer
    }));

    return res.status(200).json({
      success: true,
      payments: formattedPayments,
      qrCode: qrCode
    });
  } catch (error) {
    console.error('Erro ao buscar pagamento:', error.message);
    
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
      error: 'Erro ao buscar pagamento',
      message: error.message
    });
  }
}; 