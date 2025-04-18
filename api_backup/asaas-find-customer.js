// Endpoint para buscar informações de clientes no Asaas
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
    const { customerId, cpfCnpj, email } = req.query;

    // Validar campos obrigatórios
    if (!customerId && !cpfCnpj && !email) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar customerId, cpfCnpj ou email' 
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

    let customer = null;
    let subscriptions = [];

    // Buscar cliente por ID, CPF/CNPJ ou email
    if (customerId) {
      console.log(`Buscando cliente por ID: ${customerId}`);
      const customerResponse = await apiClient.get(`/customers/${customerId}`);
      customer = customerResponse.data;
    } else if (cpfCnpj || email) {
      console.log(`Buscando cliente por ${cpfCnpj ? 'CPF/CNPJ' : 'email'}: ${cpfCnpj || email}`);
      const searchParams = cpfCnpj ? { cpfCnpj } : { email };
      
      const customersResponse = await apiClient.get('/customers', {
        params: searchParams
      });
      
      if (customersResponse.data.data && customersResponse.data.data.length > 0) {
        customer = customersResponse.data.data[0];
      } else {
        return res.status(404).json({
          success: false,
          error: 'Cliente não encontrado'
        });
      }
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    // Buscar assinaturas do cliente
    try {
      console.log(`Buscando assinaturas do cliente: ${customer.id}`);
      const subscriptionsResponse = await apiClient.get('/subscriptions', {
        params: { customer: customer.id }
      });
      
      subscriptions = subscriptionsResponse.data.data || [];
    } catch (subscriptionsError) {
      console.error('Erro ao buscar assinaturas:', subscriptionsError.message);
    }

    // Formatar cliente
    const formattedCustomer = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      cpfCnpj: customer.cpfCnpj,
      mobilePhone: customer.mobilePhone,
      address: customer.address,
      addressNumber: customer.addressNumber,
      complement: customer.complement,
      province: customer.province,
      postalCode: customer.postalCode,
      externalReference: customer.externalReference,
      notificationDisabled: customer.notificationDisabled,
      createdAt: customer.dateCreated
    };

    // Formatar assinaturas
    const formattedSubscriptions = subscriptions.map(subscription => ({
      id: subscription.id,
      value: subscription.value,
      cycle: subscription.cycle,
      nextDueDate: subscription.nextDueDate,
      billingType: subscription.billingType,
      status: subscription.status,
      description: subscription.description
    }));

    return res.status(200).json({
      success: true,
      customer: formattedCustomer,
      subscriptions: formattedSubscriptions
    });
  } catch (error) {
    console.error('Erro ao buscar cliente:', error.message);
    
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
      error: 'Erro ao buscar cliente',
      message: error.message
    });
  }
}; 