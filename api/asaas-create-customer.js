// Endpoint de criação de cliente usando MongoDB
const axios = require('axios');
const { MongoClient } = require('mongodb');

// MongoDB Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'runcashh';

// Asaas API Configuration
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.asaas.com/v3' 
  : 'https://sandbox.asaas.com/api/v3';

// CORS Headers Configuration
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(200).end();
  }

  // Set CORS headers for all responses
  setCorsHeaders(res);
  
  console.log('[CreateCustomer] Requisição recebida');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body));
  console.log('ASAAS_API_KEY:', ASAAS_API_KEY ? 'Configurada (valor oculto)' : 'Não configurada');
  
  // Check if request method is POST
  if (req.method !== 'POST') {
    console.log('[CreateCustomer] Método não suportado:', req.method);
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  // Check for required data
  const { name, email, cpfCnpj } = req.body;
  if (!name || !email || !cpfCnpj) {
    console.log('[CreateCustomer] Dados incompletos:', { name, email, cpfCnpj });
    return res.status(400).json({ 
      error: 'Missing required data', 
      required: ['name', 'email', 'cpfCnpj'],
      received: Object.keys(req.body)
    });
  }
  
  // Validate API key
  if (!ASAAS_API_KEY) {
    console.error('[CreateCustomer] Chave de API Asaas não configurada');
    return res.status(500).json({ error: 'Asaas API key is not configured' });
  }
  
  console.log('[CreateCustomer] ASAAS_API_URL:', ASAAS_API_URL);
  console.log('[CreateCustomer] ASAAS_API_KEY (primeiros 4 chars):', ASAAS_API_KEY.substring(0, 4));
  
  let client;
  
  try {
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('[CreateCustomer] Conectado ao MongoDB');
    
    const db = client.db(DB_NAME);
    const customersCollection = db.collection('customers');
    
    // Check if customer already exists in Asaas by cpfCnpj
    console.log('[CreateCustomer] Verificando se cliente já existe no Asaas');
    
    let asaasCustomerId = null;
    
    try {
      const searchResponse = await axios({
        method: 'get',
        url: `${ASAAS_API_URL}/customers?cpfCnpj=${cpfCnpj}`,
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0'
        }
      });
      
      console.log('[CreateCustomer] Resposta da busca por CPF:', JSON.stringify(searchResponse.data));
      
      if (searchResponse.data.data && searchResponse.data.data.length > 0) {
        asaasCustomerId = searchResponse.data.data[0].id;
        console.log(`[CreateCustomer] Cliente já existe no Asaas com ID: ${asaasCustomerId}`);
      }
    } catch (error) {
      console.error('[CreateCustomer] Erro ao buscar cliente existente:', error.message);
      // Continue with creating new customer
    }
    
    let customerResponse;
    
    if (asaasCustomerId) {
      // Update existing customer
      customerResponse = await axios({
        method: 'post',
        url: `${ASAAS_API_URL}/customers/${asaasCustomerId}`,
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0'
        },
        data: {
          name,
          email,
          cpfCnpj,
          ...req.body // Include any additional fields
        }
      });
      
      console.log('[CreateCustomer] Cliente atualizado no Asaas:', JSON.stringify(customerResponse.data));
    } else {
      // Create new customer
      customerResponse = await axios({
        method: 'post',
        url: `${ASAAS_API_URL}/customers`,
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0'
        },
        data: {
          name,
          email,
          cpfCnpj,
          ...req.body, // Include any additional fields
          notificationDisabled: false
        }
      });
      
      console.log('[CreateCustomer] Novo cliente criado no Asaas:', JSON.stringify(customerResponse.data));
      asaasCustomerId = customerResponse.data.id;
    }
    
    // Save customer data to MongoDB
    const customerData = {
      name,
      email,
      cpfCnpj,
      phone: req.body.phone || null,
      asaasCustomerId: asaasCustomerId,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await customersCollection.updateOne(
      { cpfCnpj: cpfCnpj },
      { $set: customerData },
      { upsert: true }
    );
    
    console.log('[CreateCustomer] Cliente salvo no MongoDB:', 
      result.modifiedCount > 0 ? 'Atualizado' : 'Novo registro');

    return res.status(200).json({
      success: true,
      message: asaasCustomerId ? 'Customer updated successfully' : 'Customer created successfully',
      customer: {
        id: asaasCustomerId,
        name,
        email,
        cpfCnpj
      }
    });
  } catch (error) {
    console.error('[CreateCustomer] Erro:', error.message);
    
    // Log more error details if available
    if (error.response) {
      console.error('[CreateCustomer] Detalhes do erro Asaas:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    
    return res.status(error.response?.status || 500).json({
      error: 'Failed to create customer',
      message: error.response?.data?.errors?.[0]?.description || error.message
    });
  } finally {
    // Close MongoDB connection
    if (client) {
      await client.close();
      console.log('[CreateCustomer] Conexão MongoDB fechada');
    }
  }
}; 