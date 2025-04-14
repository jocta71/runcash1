const axios = require('axios');

// API handler para o Vercel Serverless
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Lidar com requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Validar dados do corpo da requisição
    const { name, email, cpfCnpj, mobilePhone } = req.body;
    
    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({ 
        error: 'Dados incompletos. Nome, email e CPF/CNPJ são obrigatórios.' 
      });
    }

    // Configurar requisição para a API do Asaas
    const asaasApiKey = process.env.ASAAS_API_KEY;
    console.log("Chave API em uso (primeiros 10 caracteres):", asaasApiKey?.substring(0, 10) + "...");
    
    if (!asaasApiKey) {
      console.error('ASAAS_API_KEY não configurada no ambiente');
      return res.status(500).json({ error: 'Erro de configuração do servidor' });
    }

    // Configuração do Axios para o Asaas
    const asaasConfig = {
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey
      }
    };

    console.log("Fazendo requisição para o Asaas com headers:", JSON.stringify({
      'Content-Type': 'application/json',
      'access_token': asaasApiKey.substring(0, 10) + "..."
    }));

    // Buscar se o cliente já existe pelo CPF/CNPJ
    const searchResponse = await axios.get(
      `https://api.asaas.com/v3/customers?cpfCnpj=${cpfCnpj}`,
      asaasConfig
    );

    // Se o cliente já existir, retornar o ID dele
    if (searchResponse.data.data && searchResponse.data.data.length > 0) {
      return res.status(200).json({ 
        customerId: searchResponse.data.data[0].id,
        message: 'Cliente já existente encontrado'
      });
    }

    // Criar novo cliente
    const createResponse = await axios.post(
      'https://api.asaas.com/v3/customers',
      {
        name,
        email,
        cpfCnpj,
        mobilePhone
      },
      asaasConfig
    );

    // Retornar o ID do cliente criado
    return res.status(201).json({ 
      customerId: createResponse.data.id,
      message: 'Cliente criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error.message);
    console.error('Detalhes do erro:', error.response?.data);
    
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.errors?.[0]?.description || 'Erro ao criar cliente no Asaas',
      details: error.response?.data || error.message
    });
  }
}; 