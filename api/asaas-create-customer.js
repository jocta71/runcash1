// Endpoint de criação de cliente usando MongoDB
const axios = require('axios');
const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  console.log('=== INÍCIO DA REQUISIÇÃO ===');
  console.log('Método:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    console.log('Requisição OPTIONS recebida - Respondendo com 200');
    return res.status(200).end();
  }

  // Apenas aceitar solicitações POST
  if (req.method !== 'POST') {
    console.log('Método não permitido:', req.method);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client;

  try {
    // Verificar dados obrigatórios
    const { name, email, cpfCnpj, phone, userId } = req.body;
    
    console.log('Dados recebidos:', { 
      name, 
      email, 
      cpfCnpj, 
      phone, 
      userId 
    });
    
    if (!name || !email || !cpfCnpj) {
      console.log('Dados incompletos:', { name, email, cpfCnpj });
      return res.status(400).json({ 
        success: false,
        error: 'Dados incompletos', 
        details: 'Nome, email e CPF/CNPJ são obrigatórios' 
      });
    }

    // Conectar ao MongoDB
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log('Conexão com MongoDB estabelecida');
    
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    
    // Verificar se o cliente já existe pelo CPF/CNPJ
    const existingCustomer = await db.collection('customers').findOne({ 
      cpf_cnpj: cpfCnpj.replace(/[^\d]/g, '')
    });
    
    if (existingCustomer && existingCustomer.asaas_id) {
      console.log(`Cliente já existe no Asaas com CPF/CNPJ ${cpfCnpj}: ${existingCustomer.asaas_id}`);
      return res.status(200).json({ 
        success: true,
        data: {
          customerId: existingCustomer.asaas_id
        },
        message: 'Cliente já cadastrado' 
      });
    }

    // Configurar chamada para API do Asaas
    // Forçar uso do sandbox enquanto estamos em teste
    const ASAAS_ENVIRONMENT = 'sandbox';
    console.log(`Usando ambiente Asaas: ${ASAAS_ENVIRONMENT}`);
    
    const asaasBaseUrl = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
    const asaasApiKey = process.env.ASAAS_API_KEY;

    console.log('Configuração do Asaas:', {
      baseUrl: asaasBaseUrl,
      apiKey: asaasApiKey ? `${asaasApiKey.substring(0, 10)}...` : 'não definido',
      environment: ASAAS_ENVIRONMENT,
      nodeEnv: process.env.NODE_ENV
    });

    if (!asaasApiKey) {
      throw new Error('Chave da API do Asaas não configurada');
    }

    if (asaasApiKey === '$api_key_aqui' || asaasApiKey.includes('$api_key')) {
      throw new Error('Chave da API do Asaas inválida - valor padrão detectado');
    }

    const requestData = {
      name,
      email,
      cpfCnpj: cpfCnpj.replace(/[^\d]/g, ''),
      mobilePhone: phone ? phone.replace(/[^\d]/g, '') : undefined,
      notificationDisabled: false
    };

    const requestHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'RunCash/1.0',
      'access_token': asaasApiKey
    };

    console.log('=== REQUISIÇÃO PARA O ASAAS ===');
    console.log('URL:', `${asaasBaseUrl}/customers`);
    console.log('Método: POST');
    console.log('Dados:', JSON.stringify(requestData, null, 2));
    console.log('Headers:', JSON.stringify({
      ...requestHeaders,
      'access_token': `${asaasApiKey.substring(0, 10)}...`
    }, null, 2));

    // Criar cliente no Asaas
    const response = await axios.post(
      `${asaasBaseUrl}/customers`,
      requestData,
      {
        headers: requestHeaders,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      }
    );

    console.log('=== RESPOSTA DO ASAAS ===');
    console.log('Status:', response.status);
    console.log('Dados:', JSON.stringify(response.data, null, 2));
    console.log('Headers:', JSON.stringify(response.headers, null, 2));

    // Verificar se a resposta foi bem sucedida
    if (response.status !== 200 && response.status !== 201) {
      console.error('=== ERRO NA RESPOSTA DO ASAAS ===');
      console.error('Status:', response.status);
      console.error('Dados:', JSON.stringify(response.data, null, 2));
      console.error('Headers:', JSON.stringify(response.headers, null, 2));
      console.error('Requisição:', {
        url: `${asaasBaseUrl}/customers`,
        method: 'POST',
        data: requestData,
        headers: {
          ...requestHeaders,
          'access_token': `${asaasApiKey.substring(0, 10)}...`
        }
      });
      throw new Error(`Erro na API do Asaas: ${response.status} - ${JSON.stringify(response.data)}`);
    }

    const asaasCustomerId = response.data.id;
    
    // Salvar cliente no MongoDB
    await db.collection('customers').insertOne({
      user_id: userId,
      asaas_id: asaasCustomerId,
      name,
      email,
      cpf_cnpj: cpfCnpj,
      phone,
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log(`Cliente criado no Asaas: ${asaasCustomerId} para usuário ${userId}`);
    
    // Responder com sucesso
    return res.status(201).json({
      success: true,
      data: {
        customerId: asaasCustomerId
      },
      message: 'Cliente criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error);
    console.error('Detalhes do erro:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      } : 'Sem resposta'
    });
    
    // Tratar erros específicos da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({ 
      success: false,
      error: 'Erro ao criar cliente',
      message: error.message 
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 