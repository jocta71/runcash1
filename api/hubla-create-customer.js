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
    // Extrair dados do cliente da requisição
    const { 
      name, 
      email, 
      cpfCnpj, 
      mobilePhone,
      address = {},
      additionalEmails,
      externalReference
    } = req.body;

    // Validar campos obrigatórios
    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({ 
        error: 'Dados incompletos. Nome, email e CPF/CNPJ são obrigatórios.' 
      });
    }

    // Configurar requisição para a API do Hubla
    const hublaApiKey = process.env.HUBLA_API_KEY;
    console.log("Chave API em uso (primeiros 10 caracteres):", hublaApiKey?.substring(0, 10) + "...");
    
    if (!hublaApiKey) {
      console.error('HUBLA_API_KEY não configurada no ambiente');
      return res.status(500).json({ error: 'Erro de configuração do servidor' });
    }

    // Configuração do Axios para o Hubla
    const hublaConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hublaApiKey}`
      }
    };

    // Remover caracteres especiais do CPF/CNPJ
    const formattedCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');
    
    // Formatar número de telefone (remover caracteres especiais)
    const formattedPhone = mobilePhone ? mobilePhone.replace(/[^\d]/g, '') : null;

    console.log("Verificando se o cliente já existe:", formattedCpfCnpj);

    // Primeiro, verificar se o cliente já existe pelo CPF/CNPJ
    const searchResponse = await axios.get(
      `https://api.hubla.com.br/v1/customers?document=${formattedCpfCnpj}`,
      hublaConfig
    );

    // Se o cliente já existe, retorna o ID existente
    if (searchResponse.data && searchResponse.data.length > 0) {
      const existingCustomer = searchResponse.data[0];
      console.log(`Cliente já existe no Hubla: ${existingCustomer.id}`);
      
      return res.status(200).json({
        customerId: existingCustomer.id,
        message: 'Cliente já existe',
        isExisting: true
      });
    }

    // Preparar dados do cliente para criação
    const customerData = {
      name,
      email,
      document: formattedCpfCnpj,
      documentType: formattedCpfCnpj.length > 11 ? 'CNPJ' : 'CPF',
      externalReference
    };

    // Adicionar número de telefone se fornecido
    if (formattedPhone) {
      customerData.phoneNumber = formattedPhone;
    }

    // Adicionar endereço se fornecido
    if (address && Object.keys(address).length > 0) {
      customerData.address = {
        street: address.street || '',
        number: address.number || '',
        complement: address.complement || '',
        neighborhood: address.neighborhood || '',
        city: address.city || '',
        state: address.state || '',
        postalCode: address.postalCode?.replace(/[^\d]/g, '') || '',
        country: address.country || 'BR'
      };
    }

    // Adicionar emails adicionais se fornecidos
    if (additionalEmails && additionalEmails.length > 0) {
      customerData.additionalEmails = additionalEmails;
    }

    console.log("Criando novo cliente no Hubla:", JSON.stringify({
      name,
      email,
      document: formattedCpfCnpj,
      documentType: customerData.documentType
    }));

    // Criar o cliente no Hubla
    const createResponse = await axios.post(
      'https://api.hubla.com.br/v1/customers',
      customerData,
      hublaConfig
    );

    // Verificar resposta da API
    if (createResponse.status === 200 || createResponse.status === 201) {
      const customerId = createResponse.data.id;
      console.log(`Cliente criado com sucesso: ${customerId}`);

      return res.status(201).json({
        customerId,
        message: 'Cliente criado com sucesso',
        isExisting: false
      });
    } else {
      throw new Error(`Resposta inesperada da API do Hubla: ${createResponse.status}`);
    }
  } catch (error) {
    console.error('Erro ao criar cliente no Hubla:', error.message);
    
    // Loggar detalhes do erro se disponíveis
    if (error.response) {
      console.error('Status do erro:', error.response.status);
      console.error('Detalhes do erro:', error.response.data);
    }
    
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || 'Erro ao criar cliente no Hubla',
      details: error.response?.data || error.message
    });
  }
}; 