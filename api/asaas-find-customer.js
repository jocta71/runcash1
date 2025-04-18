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

  // Apenas aceitar solicitações GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Extrair parâmetros
    const { customerId, cpfCnpj, email } = req.query;

    if (!customerId && !cpfCnpj && !email) {
      return res.status(400).json({ 
        error: 'Parâmetro obrigatório não fornecido', 
        details: 'Você deve fornecer pelo menos um dos seguintes parâmetros: customerId, cpfCnpj ou email' 
      });
    }

    // Configuração da API do Asaas
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    const API_URL = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!ASAAS_API_KEY) {
      return res.status(500).json({ error: 'Chave de API do Asaas não configurada' });
    }

    // Buscar cliente por ID
    if (customerId) {
      const response = await axios.get(`${API_URL}/customers/${customerId}`, {
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      return res.json({
        success: true,
        customer: response.data
      });
    }
    
    // Buscar cliente por CPF/CNPJ ou email
    const params = {};
    if (cpfCnpj) params.cpfCnpj = cpfCnpj;
    if (email) params.email = email;
    
    const response = await axios.get(`${API_URL}/customers`, {
      params,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    // Verificar se foram encontrados resultados
    if (response.data.data && response.data.data.length > 0) {
      return res.json({
        success: true,
        customer: response.data.data[0],
        total: response.data.data.length
      });
    } else {
      return res.json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }
  } catch (error) {
    console.error('Erro ao processar solicitação:', error.message);
    
    // Verificar se o erro é da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({
      error: 'Erro ao processar solicitação',
      message: error.message
    });
  }
}; 