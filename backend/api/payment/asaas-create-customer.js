// Endpoint de criação de cliente usando MongoDB
const axios = require('axios');
const { MongoClient } = require('mongodb');

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
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client;
  
  try {
    const { name, email, cpfCnpj, mobilePhone } = req.body;

    // Validar campos obrigatórios
    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, email, cpfCnpj' });
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

    // Configuração do cliente HTTP
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    // Verificar se o cliente já existe pelo CPF/CNPJ
    try {
      console.log(`Buscando cliente pelo CPF/CNPJ: ${cpfCnpj}`);
      const searchResponse = await apiClient.get('/customers', {
        params: { cpfCnpj }
      });

      // Se já existir um cliente com este CPF/CNPJ, retorná-lo
      if (searchResponse.data.data && searchResponse.data.data.length > 0) {
        const existingCustomer = searchResponse.data.data[0];
        console.log(`Cliente já existe, ID: ${existingCustomer.id}`);

        // Opcionalmente, atualizar dados do cliente se necessário
        await apiClient.post(`/customers/${existingCustomer.id}`, {
          name,
          email,
          mobilePhone
        });

        // Conectar ao MongoDB e registrar o cliente se necessário
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
        
        // Verificar se o cliente já existe no MongoDB
        const existingDbCustomer = await db.collection('customers').findOne({ asaas_id: existingCustomer.id });
        
        if (!existingDbCustomer) {
          // Registrar o cliente no MongoDB
          await db.collection('customers').insertOne({
            asaas_id: existingCustomer.id,
            name,
            email,
            cpfCnpj,
            createdAt: new Date()
          });
        }

        return res.json({
          customerId: existingCustomer.id,
          message: 'Cliente recuperado e atualizado com sucesso'
        });
      }
    } catch (searchError) {
      console.error('Erro ao buscar cliente:', searchError.message);
      // Continuar para criar novo cliente
    }

    // Criar novo cliente
    console.log('Criando novo cliente no Asaas');
    const customerData = {
      name,
      email,
      cpfCnpj,
      mobilePhone,
      notificationDisabled: false
    };

    const createResponse = await apiClient.post('/customers', customerData);
    const newCustomer = createResponse.data;
    console.log(`Novo cliente criado, ID: ${newCustomer.id}`);

    // Conectar ao MongoDB e registrar o novo cliente
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    await db.collection('customers').insertOne({
      asaas_id: newCustomer.id,
      name,
      email,
      cpfCnpj,
      createdAt: new Date()
    });

    return res.json({
      customerId: newCustomer.id,
      message: 'Cliente criado com sucesso'
    });
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
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 