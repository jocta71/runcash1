const axios = require('axios');

// Configurações da API Asaas
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

  // Apenas aceitar GET para buscar assinaturas
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { subscriptionId } = req.query;
    
    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }
    
    if (!ASAAS_API_KEY) {
      return res.status(500).json({ error: 'ASAAS API key not configured' });
    }
    
    console.log(`Buscando informações da assinatura: ${subscriptionId}`);
    
    // Buscar informações da assinatura na API do Asaas
    const subscriptionResponse = await axios.get(
      `${API_BASE_URL}/subscriptions/${subscriptionId}`,
      { headers: { 'access_token': ASAAS_API_KEY } }
    );
    
    // Buscar pagamentos relacionados à assinatura
    const paymentsResponse = await axios.get(
      `${API_BASE_URL}/payments?subscription=${subscriptionId}`,
      { headers: { 'access_token': ASAAS_API_KEY } }
    );
    
    return res.status(200).json({
      success: true,
      subscription: subscriptionResponse.data,
      payments: paymentsResponse.data.data || []
    });
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error);
    
    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({
      error: 'Erro ao buscar assinatura',
      message: error.message
    });
  }
}; 