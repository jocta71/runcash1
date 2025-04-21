// Endpoint de atualização de cliente Asaas
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

  // Apenas aceitar solicitações POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }

  try {
    const { customerId, name, email, cpfCnpj, mobilePhone } = req.body;

    // Validar campo obrigatório customerId
    if (!customerId) {
      return res.status(400).json({ 
        success: false,
        error: 'Campo obrigatório: customerId' 
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

    console.log(`Atualizando cliente ${customerId} com novos dados`);
    
    // Preparar dados para atualização
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (cpfCnpj) updateData.cpfCnpj = cpfCnpj;
    if (mobilePhone) updateData.mobilePhone = mobilePhone;
    
    // Chamar API para atualizar
    const updateResponse = await apiClient.post(`/customers/${customerId}`, updateData);
    const updatedCustomer = updateResponse.data;
    
    console.log(`Cliente ${customerId} atualizado com sucesso`);
    
    return res.status(200).json({
      success: true,
      id: updatedCustomer.id,
      customerId: updatedCustomer.id,
      customer: updatedCustomer,
      message: 'Cliente atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar solicitação:', error.message);
    
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
      error: 'Erro ao processar solicitação',
      message: error.message
    });
  }
}; 