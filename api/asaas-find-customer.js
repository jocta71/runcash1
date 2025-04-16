// Endpoint para buscar detalhes de um cliente no Asaas

// Importar módulos necessários
const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configuração para CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// URL de conexão com MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('MONGODB_URI não configurado');

// Configuração do Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const ASAAS_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://api.asaas.com/v3' 
  : 'https://sandbox.asaas.com/api/v3';

// Função principal do endpoint
module.exports = async (req, res) => {
  // Configurar headers CORS para todas as respostas
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  // Verificar se é um preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validar método HTTP
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  // Obter parâmetros da query string
  const { customerId, cpfCnpj, email } = req.query;
  
  if (!customerId && !cpfCnpj && !email) {
    return res.status(400).json({ 
      success: false, 
      error: 'É necessário informar customerId, cpfCnpj ou email' 
    });
  }

  console.log(`Buscando cliente: ${customerId || cpfCnpj || email}`);

  let client;
  
  try {
    // Conectar ao MongoDB
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Conexão com MongoDB estabelecida');
    
    const db = client.db();
    const customersCollection = db.collection('customers');
    
    // Se tiver o customerId, buscar por ele diretamente no Asaas
    if (customerId) {
      console.log(`Consultando a API do Asaas para o cliente ID ${customerId}...`);
      
      const asaasResponse = await axios.get(`${ASAAS_BASE_URL}/customers/${customerId}`, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': ASAAS_API_KEY
        }
      });
      
      console.log('Resposta da API do Asaas:', {
        status: asaasResponse.status,
        statusText: asaasResponse.statusText
      });
      
      const customer = asaasResponse.data;
      
      // Atualizar ou inserir no MongoDB
      if (customer && customer.id) {
        await customersCollection.updateOne(
          { id: customer.id },
          { $set: { ...customer, updatedAt: new Date() } },
          { upsert: true }
        );
      }
      
      // Buscar as assinaturas deste cliente
      const subscriptionsResponse = await axios.get(`${ASAAS_BASE_URL}/subscriptions?customer=${customerId}`, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': ASAAS_API_KEY
        }
      });
      
      // Adicionar as assinaturas ao objeto de retorno
      const subscriptionsData = subscriptionsResponse.data;
      const subscriptions = subscriptionsData.data || [];
      
      // Retornar os dados do cliente e suas assinaturas
      return res.status(200).json({ 
        success: true,
        customer,
        subscriptions
      });
    } else {
      // Buscar por CPF/CNPJ ou email
      let filter = '';
      if (cpfCnpj) {
        filter = `cpfCnpj=${cpfCnpj}`;
      } else if (email) {
        filter = `email=${encodeURIComponent(email)}`;
      }
      
      console.log(`Consultando a API do Asaas para clientes com ${filter}...`);
      
      const asaasResponse = await axios.get(`${ASAAS_BASE_URL}/customers?${filter}`, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': ASAAS_API_KEY
        }
      });
      
      console.log('Resposta da API do Asaas:', {
        status: asaasResponse.status,
        statusText: asaasResponse.statusText
      });
      
      const customersData = asaasResponse.data;
      const customers = customersData.data || [];
      
      // Se encontrou pelo menos um cliente, retornar o primeiro
      if (customers.length > 0) {
        const customer = customers[0];
        
        // Atualizar ou inserir no MongoDB
        if (customer && customer.id) {
          await customersCollection.updateOne(
            { id: customer.id },
            { $set: { ...customer, updatedAt: new Date() } },
            { upsert: true }
          );
          
          // Buscar as assinaturas deste cliente
          const subscriptionsResponse = await axios.get(`${ASAAS_BASE_URL}/subscriptions?customer=${customer.id}`, {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'RunCash/1.0',
              'access_token': ASAAS_API_KEY
            }
          });
          
          // Adicionar as assinaturas ao objeto de retorno
          const subscriptionsData = subscriptionsResponse.data;
          const subscriptions = subscriptionsData.data || [];
          
          // Retornar os dados do cliente e suas assinaturas
          return res.status(200).json({ 
            success: true,
            customer,
            subscriptions,
            totalCustomers: customers.length
          });
        }
      }
      
      // Não encontrou nenhum cliente com os critérios informados
      return res.status(404).json({ 
        success: false,
        error: 'Cliente não encontrado',
        totalCustomers: customers.length,
        customers: customers
      });
    }
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    
    let errorMessage = 'Erro ao buscar detalhes do cliente';
    let statusCode = 500;
    
    if (error.response) {
      // Erro da API do Asaas
      statusCode = error.response.status;
      errorMessage = `Erro na API do Asaas: ${statusCode} - ${JSON.stringify(error.response.data)}`;
      console.error('Detalhes do erro da API:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      // Erro na requisição (sem resposta)
      errorMessage = 'Sem resposta da API do Asaas';
      console.error('Sem resposta da API:', error.request);
    } else {
      // Outros erros
      errorMessage = error.message;
    }
    
    return res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      details: error.message
    });
  } finally {
    // Fechar conexão com MongoDB
    if (client) {
      await client.close();
      console.log('Conexão com MongoDB fechada');
    }
  }
}; 