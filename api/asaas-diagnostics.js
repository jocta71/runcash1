// Diagnóstico para verificar conexão com a API do Asaas
const axios = require('axios');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Método não permitido, use GET' 
    });
  }

  // Coletar informações para diagnóstico
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      asaasEnvironment: process.env.ASAAS_ENVIRONMENT || 'não definido',
      mongoEnabled: process.env.MONGODB_ENABLED || 'não definido',
      apiUrl: process.env.ASAAS_ENVIRONMENT === 'production' 
        ? 'https://api.asaas.com/v3'
        : 'https://sandbox.asaas.com/api/v3'
    },
    apiKeyExists: !!process.env.ASAAS_API_KEY,
    mongoUriExists: !!process.env.MONGODB_URI,
    tests: {
      asaasConnection: null
    }
  };

  try {
    // Testar conexão com Asaas
    console.log('Testando conexão com API Asaas...');
    
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    
    if (!ASAAS_API_KEY) {
      throw new Error('Chave de API do Asaas não configurada');
    }
    
    const API_URL = diagnostics.environment.apiUrl;
    
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    // Fazer uma requisição simples à API Asaas
    const asaasResponse = await apiClient.get('/customers?limit=1');
    
    diagnostics.tests.asaasConnection = {
      success: true,
      status: asaasResponse.status,
      statusText: asaasResponse.statusText,
      hasData: !!asaasResponse.data
    };
    
    console.log('Teste de conexão com Asaas concluído com sucesso.');
  } catch (error) {
    console.error('Erro ao testar conexão com Asaas:', error);
    
    diagnostics.tests.asaasConnection = {
      success: false,
      error: error.message,
      status: error.response?.status,
      details: error.response?.data || error.stack
    };
  }

  // Responder com o diagnóstico
  return res.status(200).json({
    success: true,
    diagnostics
  });
}; 