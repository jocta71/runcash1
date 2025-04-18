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

  // Apenas aceitar POST para criar clientes
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const customerData = req.body;
    
    if (!customerData.name || !customerData.cpfCnpj) {
      return res.status(400).json({ error: 'Nome e CPF/CNPJ são obrigatórios' });
    }
    
    console.log('Criando cliente no Asaas:', {
      ...customerData,
      cpfCnpj: customerData.cpfCnpj ? '********' : undefined // Ocultar CPF/CNPJ nos logs por segurança
    });
    
    // Criar cliente na API do Asaas
    const response = await axios.post(
      `${API_BASE_URL}/customers`,
      customerData,
      { headers: { 'access_token': ASAAS_API_KEY } }
    );
    
    console.log('Cliente criado com sucesso:', response.data.id);
    
    return res.status(200).json({
      success: true,
      customerId: response.data.id,
      customer: response.data
    });
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error);
    
    // Verificar se o erro é por CPF/CNPJ duplicado
    if (error.response?.data?.errors?.[0]?.code === 'invalid_cpfCnpj' && 
        error.response?.data?.errors?.[0]?.description?.includes('já utilizado')) {
      
      console.log('CPF/CNPJ já utilizado, buscando cliente existente...');
      
      try {
        // Buscar cliente pelo CPF/CNPJ
        const cpfCnpj = req.body.cpfCnpj;
        const searchResponse = await axios.get(
          `${API_BASE_URL}/customers?cpfCnpj=${cpfCnpj}`,
          { headers: { 'access_token': ASAAS_API_KEY } }
        );
        
        if (searchResponse.data.data && searchResponse.data.data.length > 0) {
          const existingCustomer = searchResponse.data.data[0];
          console.log(`Cliente existente recuperado! ID: ${existingCustomer.id}`);
          
          return res.status(200).json({
            success: true,
            customerId: existingCustomer.id,
            customer: existingCustomer,
            existing: true
          });
        }
      } catch (searchError) {
        console.error('Erro ao buscar cliente existente:', searchError);
      }
    }
    
    if (error.response) {
      // Se for erro da API do Asaas, retornar os detalhes
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({
      error: 'Erro ao criar cliente',
      message: error.message
    });
  }
}; 