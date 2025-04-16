// Endpoint de criação de cliente usando MongoDB
const axios = require('axios');
const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  console.log('=== INÍCIO DA REQUISIÇÃO CRIAR CLIENTE ===');
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
    const { 
      name, 
      email, 
      cpfCnpj, 
      userId, 
      phone = '', 
      postalCode = '', 
      address = '', 
      addressNumber = '', 
      complement = '', 
      neighborhood = '' 
    } = req.body;
    
    console.log('Dados recebidos:', { name, email, cpfCnpj, userId });
    
    if (!name || !email || !cpfCnpj) {
      console.log('Dados incompletos:', { name, email, cpfCnpj });
      return res.status(400).json({ 
        success: false,
        error: 'Dados incompletos', 
        details: 'Nome, e-mail e CPF/CNPJ são obrigatórios' 
      });
    }

    // Conectar ao MongoDB
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log('Conexão com MongoDB estabelecida');
    
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    const customersCollection = db.collection('customers');

    // Verificar se o cliente já existe no MongoDB
    const existingCustomer = await customersCollection.findOne({ cpf_cnpj: cpfCnpj });
    if (existingCustomer && existingCustomer.asaas_id) {
      console.log(`Cliente já existe no MongoDB com ID Asaas: ${existingCustomer.asaas_id}`);
      return res.status(200).json({
        success: true,
        data: {
          id: existingCustomer.asaas_id,
          name: existingCustomer.name,
          email: existingCustomer.email,
          cpfCnpj: existingCustomer.cpf_cnpj
        },
        message: 'Cliente já existe'
      });
    }

    // Configuração para a API do Asaas
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_API_URL = process.env.NODE_ENV === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    console.log('ASAAS_API_KEY:', ASAAS_API_KEY ? '******' : 'não definido');
    console.log('ASAAS_API_URL:', ASAAS_API_URL);

    if (!ASAAS_API_KEY) {
      console.error('ASAAS_API_KEY não configurada!');
      return res.status(500).json({ success: false, error: 'Erro de configuração da API' });
    }

    // Logs para debugging
    console.log('Tentando criar cliente no Asaas');
    console.log('API Key:', `${ASAAS_API_KEY.substring(0, 5)}...${ASAAS_API_KEY.substring(ASAAS_API_KEY.length - 5)}`);

    // Configurar requisição para API do Asaas
    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
        'User-Agent': 'RunCash/1.0'
      }
    };

    console.log('Configuração da requisição para Asaas:', JSON.stringify(axiosConfig, null, 2));

    try {
      // Verificar se o cliente já existe
      const checkCustomerResponse = await axios.get(
        `${ASAAS_API_URL}/customers?cpfCnpj=${cpfCnpj}`,
        axiosConfig
      );

      console.log('Resposta da verificação do cliente:', JSON.stringify(checkCustomerResponse.data, null, 2));

      let customerId;
      let customerData;

      if (checkCustomerResponse.data.data && checkCustomerResponse.data.data.length > 0) {
        // Cliente já existe, fazer update
        customerId = checkCustomerResponse.data.data[0].id;
        console.log(`Cliente já existe com ID: ${customerId}. Atualizando informações.`);

        const updateResponse = await axios.post(
          `${ASAAS_API_URL}/customers/${customerId}`,
          {
            name,
            email,
            phone,
            mobilePhone: phone,
            cpfCnpj,
            postalCode,
            address,
            addressNumber,
            complement,
            province: neighborhood
          },
          axiosConfig
        );

        customerData = updateResponse.data;
        console.log('Cliente atualizado com sucesso:', JSON.stringify(customerData, null, 2));
      } else {
        // Cliente não existe, criar novo
        console.log('Cliente não encontrado. Criando novo cliente.');
        
        const createResponse = await axios.post(
          `${ASAAS_API_URL}/customers`,
          {
            name,
            email,
            phone,
            mobilePhone: phone,
            cpfCnpj,
            postalCode,
            address,
            addressNumber,
            complement,
            province: neighborhood
          },
          axiosConfig
        );

        customerData = createResponse.data;
        customerId = customerData.id;
        console.log('Cliente criado com sucesso:', JSON.stringify(customerData, null, 2));
      }

      // Atualizar ou criar no MongoDB
      const customerDataMongo = {
        user_id: userId,
        name: name,
        email: email,
        cpf_cnpj: cpfCnpj,
        asaas_id: customerId,
        updated_at: new Date()
      };
      
      if (existingCustomer) {
        await customersCollection.updateOne(
          { _id: existingCustomer._id },
          { $set: customerDataMongo }
        );
        console.log('Cliente atualizado no MongoDB');
      } else {
        await customersCollection.insertOne({
          ...customerDataMongo,
          created_at: new Date()
        });
        console.log('Cliente criado no MongoDB com ID Asaas existente');
      }
      
      return res.status(200).json({
        success: true,
        data: {
          id: customerId,
          message: 'Cliente criado/atualizado com sucesso'
        }
      });
    } catch (searchError) {
      console.error('Erro ao verificar cliente existente no Asaas:', searchError);
      console.error('Detalhes do erro na busca:', {
        status: searchError.response?.status,
        statusText: searchError.response?.statusText,
        data: searchError.response?.data,
        message: searchError.message
      });
      
      if (searchError.response?.status === 401) {
        console.error('ERRO DE AUTENTICAÇÃO: Chave de API inválida ou expirada');
      }
    }
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error);
    console.error('Detalhes do erro:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
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
    console.log('=== FIM DA REQUISIÇÃO CRIAR CLIENTE ===');
  }
}; 