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

  // Extrair dados da requisição
  const { name, email, cpfCnpj, mobilePhone, userId } = req.body;

  // Validar campos obrigatórios
  if (!name || !email || !cpfCnpj || !mobilePhone || !userId) {
    return res.status(400).json({
      error: 'Dados incompletos',
      message: 'Todos os campos são obrigatórios: name, email, cpfCnpj, mobilePhone, userId'
    });
  }

  // Normalizar CPF/CNPJ removendo caracteres não numéricos
  const normalizedCpfCnpj = cpfCnpj.replace(/\D/g, '');
  // Normalizar telefone removendo caracteres não numéricos
  const normalizedPhone = mobilePhone.replace(/\D/g, '');

  // Conexão com MongoDB
  let client;
  try {
    // Verificar se já existe um cliente com este CPF/CNPJ para este usuário
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    const existingCustomer = await db.collection('customers').findOne({
      userId,
      cpfCnpj: normalizedCpfCnpj
    });

    // Se já existe cliente, retornar os dados
    if (existingCustomer) {
      console.log(`Cliente já existe para o usuário ${userId} com CPF/CNPJ ${normalizedCpfCnpj}`);
      return res.status(200).json({ 
        message: 'Cliente já cadastrado',
        customer: existingCustomer
      });
    }

    // Configuração da API Asaas
    const apiKey = process.env.ASAAS_API_KEY;
    const apiBaseUrl = process.env.ASAAS_ENV === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!apiKey) {
      console.error('Chave da API Asaas não configurada');
      return res.status(500).json({ error: 'Configuração do servidor incompleta' });
    }

    // Preparar dados para a API Asaas
    const customerData = {
      name,
      email,
      cpfCnpj: normalizedCpfCnpj,
      mobilePhone: normalizedPhone,
      notificationDisabled: false,
      externalReference: userId // Usar o ID do usuário como referência externa
    };

    // Realizar requisição para a API Asaas
    console.log('Enviando requisição para criação de cliente no Asaas');
    const response = await axios.post(`${apiBaseUrl}/customers`, customerData, {
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      }
    });

    console.log('Resposta da API Asaas:', response.data);

    // Salvar dados do cliente no MongoDB
    const newCustomer = {
      userId,
      name,
      email,
      cpfCnpj: normalizedCpfCnpj,
      mobilePhone: normalizedPhone,
      asaasId: response.data.id,
      asaasData: response.data,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.collection('customers').insertOne(newCustomer);
    console.log(`Cliente ${name} criado com sucesso no MongoDB e Asaas`);

    // Retornar sucesso
    return res.status(201).json({
      message: 'Cliente criado com sucesso',
      customer: newCustomer
    });

  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    
    // Verificar se o erro é da API Asaas
    if (error.response && error.response.data) {
      console.error('Erro API Asaas:', error.response.data);
      return res.status(error.response.status || 500).json({
        error: 'Erro ao processar a requisição no Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({ 
      error: 'Erro ao processar a requisição',
      message: error.message 
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 