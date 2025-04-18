const axios = require('axios');

// Configurações do ambiente
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

  // Apenas requisições GET são suportadas
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed', method: req.method });
  }

  try {
    // Verificar se a chave de API do Asaas está configurada
    if (!ASAAS_API_KEY) {
      return res.status(500).json({ error: 'API key do Asaas não configurada' });
    }

    // Obter parâmetros da consulta
    const { customerId, email, cpfCnpj } = req.query;

    if (!customerId && !email && !cpfCnpj) {
      return res.status(400).json({ 
        error: 'Parâmetros insuficientes', 
        message: 'É necessário fornecer pelo menos um dos seguintes parâmetros: customerId, email ou cpfCnpj' 
      });
    }

    // Se tiver o ID do cliente, buscar diretamente
    if (customerId) {
      console.log(`Buscando cliente pelo ID: ${customerId}`);
      
      const response = await axios({
        method: 'get',
        url: `${API_BASE_URL}/customers/${customerId}`,
        headers: {
          'access_token': ASAAS_API_KEY
        }
      });

      return res.status(200).json({
        success: true,
        customer: response.data
      });
    }

    // Se não tiver o ID, buscar por outros parâmetros
    let queryParams = '';
    
    if (email) {
      queryParams += `email=${encodeURIComponent(email)}`;
    }
    
    if (cpfCnpj) {
      if (queryParams) queryParams += '&';
      queryParams += `cpfCnpj=${encodeURIComponent(cpfCnpj)}`;
    }

    console.log(`Buscando cliente por: ${queryParams}`);
    
    const response = await axios({
      method: 'get',
      url: `${API_BASE_URL}/customers?${queryParams}`,
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });

    const customers = response.data.data || [];

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum cliente encontrado com os parâmetros fornecidos'
      });
    }

    return res.status(200).json({
      success: true,
      customer: customers[0], // Retorna o primeiro cliente encontrado
      totalCustomers: customers.length,
      allCustomers: customers.length > 1 ? customers : undefined
    });

  } catch (error) {
    console.error('Erro ao buscar cliente:', error);

    // Verificar se é um erro da API do Asaas
    if (error.response) {
      // Se for erro 404, cliente não encontrado
      if (error.response.status === 404) {
        return res.status(404).json({
          success: false,
          message: 'Cliente não encontrado'
        });
      }
      
      return res.status(error.response.status || 500).json({
        error: 'Erro ao buscar cliente no Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({
      error: 'Erro ao processar solicitação',
      message: error.message
    });
  }
}; 