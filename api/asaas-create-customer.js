// Endpoint de criação de cliente usando MongoDB
const axios = require('axios');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

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
    // Verificar dados obrigatórios
    const { name, email, cpfCnpj, phone } = req.body;
    
    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({ 
        success: false,
        error: 'Dados incompletos', 
        details: 'Nome, email e CPF/CNPJ são obrigatórios' 
      });
    }

    // Gerar userId aleatório
    const userId = crypto.randomBytes(16).toString('hex');

    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    // Verificar se o cliente já existe para este CPF/CNPJ
    const existingCustomer = await db.collection('customers').findOne({ cpf_cnpj: cpfCnpj });
    
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
    const asaasBaseUrl = 'https://sandbox.asaas.com/api/v3';
    const asaasApiKey = process.env.ASAAS_API_KEY;

    console.log('Variáveis de ambiente disponíveis:', {
      ASAAS_API_KEY: asaasApiKey ? 'definida' : 'não definida',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    });

    if (!asaasApiKey) {
      throw new Error('Chave da API do Asaas não configurada');
    }

    if (asaasApiKey === '$api_key_aqui' || asaasApiKey.includes('$api_key')) {
      throw new Error('Chave da API do Asaas inválida - valor padrão detectado');
    }

    console.log('Fazendo requisição para o Asaas com os headers:', {
      'Content-Type': 'application/json',
      'User-Agent': 'RunCash/1.0',
      'access_token': asaasApiKey ? `${asaasApiKey.substring(0, 5)}...${asaasApiKey.substring(asaasApiKey.length - 5)}` : 'não definido'
    });

    // Preparar dados para criação do cliente no Asaas
    const customerData = {
      name,
      email,
      cpfCnpj: cpfCnpj.replace(/[^\d]/g, ''), // Remover formatação
      mobilePhone: phone ? phone.replace(/[^\d]/g, '') : undefined,
      notificationDisabled: false
    };

    // Criar cliente no Asaas
    const response = await axios.post(
      `${asaasBaseUrl}/customers`,
      customerData,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': asaasApiKey
        }
      }
    );

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
        customerId: asaasCustomerId,
        userId: userId
      },
      message: 'Cliente criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error);
    
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