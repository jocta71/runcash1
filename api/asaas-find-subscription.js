// Endpoint para buscar informações de assinaturas no Asaas
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
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }
  
  try {
    const { subscriptionId, customerId } = req.query;

    // Validar campos obrigatórios
    if (!subscriptionId && !customerId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar subscriptionId ou customerId' 
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

    let subscriptionsData = [];
    let payments = [];

    // Buscar assinatura específica ou lista de assinaturas
    if (subscriptionId) {
      console.log(`Buscando assinatura específica: ${subscriptionId}`);
      const subscriptionResponse = await apiClient.get(`/subscriptions/${subscriptionId}`);
      subscriptionsData = [subscriptionResponse.data];
      
      // Buscar pagamentos associados à assinatura
      try {
        const paymentsResponse = await apiClient.get('/payments', {
          params: { subscription: subscriptionId }
        });
        
        payments = paymentsResponse.data.data || [];
      } catch (paymentsError) {
        console.error('Erro ao buscar pagamentos da assinatura:', paymentsError.message);
      }
    } else if (customerId) {
      console.log(`Buscando assinaturas do cliente: ${customerId}`);
      const subscriptionsResponse = await apiClient.get('/subscriptions', {
        params: { customer: customerId }
      });
      subscriptionsData = subscriptionsResponse.data.data || [];
    }

    // Formatar resposta
    const formattedSubscriptions = subscriptionsData.map(subscription => ({
      id: subscription.id,
      customer: subscription.customer,
      status: subscription.status,
      value: subscription.value,
      nextDueDate: subscription.nextDueDate,
      cycle: subscription.cycle,
      billingType: subscription.billingType,
      description: subscription.description,
      createdDate: subscription.dateCreated
    }));

    // Formatar pagamentos, se disponíveis
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      status: payment.status,
      value: payment.value,
      dueDate: payment.dueDate,
      billingType: payment.billingType,
      invoiceUrl: payment.invoiceUrl
    }));

    return res.status(200).json({
      success: true,
      subscriptions: formattedSubscriptions,
      payments: formattedPayments.length > 0 ? formattedPayments : undefined
    });
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error.message);
    
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
      error: 'Erro ao buscar assinatura',
      message: error.message
    });
  }
}; 