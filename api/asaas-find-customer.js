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

  // Apenas aceitar GET para buscar clientes
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { customerId, cpfCnpj, email } = req.query;
    
    if (!customerId && !cpfCnpj && !email) {
      return res.status(400).json({ error: 'É necessário fornecer customerId, cpfCnpj ou email para buscar um cliente' });
    }
    
    if (!ASAAS_API_KEY) {
      return res.status(500).json({ error: 'ASAAS API key not configured' });
    }
    
    // Verificar tipo de busca
    if (customerId) {
      console.log(`Buscando cliente por ID: ${customerId}`);
      
      // Buscar cliente por ID
      const response = await axios.get(
        `${API_BASE_URL}/customers/${customerId}`,
        { headers: { 'access_token': ASAAS_API_KEY } }
      );
      
      return res.status(200).json({
        success: true,
        customer: response.data
      });
    } else {
      // Buscar cliente por CPF/CNPJ ou email
      const queryParams = cpfCnpj ? `cpfCnpj=${cpfCnpj}` : `email=${email}`;
      console.log(`Buscando cliente por ${cpfCnpj ? 'CPF/CNPJ' : 'email'}: ${cpfCnpj || email}`);
      
      const response = await axios.get(
        `${API_BASE_URL}/customers?${queryParams}`,
        { headers: { 'access_token': ASAAS_API_KEY } }
      );
      
      const customers = response.data.data || [];
      
      if (customers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente não encontrado'
        });
      }
      
      return res.status(200).json({
        success: true,
        customer: customers[0],
        totalCustomers: customers.length
      });
    }
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    
    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({
      error: 'Erro ao buscar cliente',
      message: error.message
    });
  }
}; 