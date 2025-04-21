// Endpoint de criação de cliente usando MongoDB para Vercel
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

  // Capturar ID do cliente da URL se for uma atualização
  const urlParts = req.url.split('/');
  const customerId = urlParts.length > 2 ? urlParts[2].split('?')[0] : null;
  const isUpdate = customerId || (req.body && req.body.update === true);

  // Apenas aceitar solicitações POST ou GET
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Para requisições GET, redirecionar para asaas-find-customer
  if (req.method === 'GET') {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Campo email é obrigatório para busca' 
      });
    }
    
    // Redirecionar para o endpoint de busca
    try {
      console.log(`Buscando cliente pelo email: ${email}`);
      
      // Configuração da API do Asaas
      const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
      const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
      const API_URL = ASAAS_ENVIRONMENT === 'production'
        ? 'https://api.asaas.com/v3'
        : 'https://sandbox.asaas.com/api/v3';

      if (!ASAAS_API_KEY) {
        return res.status(500).json({ 
          success: false,
          error: 'Chave de API do Asaas não configurada' 
        });
      }

      // Configuração do cliente HTTP
      const apiClient = axios.create({
        baseURL: API_URL,
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      const searchResponse = await apiClient.get('/customers', {
        params: { email }
      });

      // Se encontrou cliente, retornar
      if (searchResponse.data.data && searchResponse.data.data.length > 0) {
        const existingCustomer = searchResponse.data.data[0];
        console.log(`Cliente encontrado, ID: ${existingCustomer.id}`);
        
        return res.status(200).json({
          success: true,
          id: existingCustomer.id,
          customerId: existingCustomer.id,
          customer: existingCustomer,
          message: 'Cliente encontrado com sucesso'
        });
      } else {
        return res.status(404).json({
          success: false,
          error: 'Cliente não encontrado'
        });
      }
    } catch (error) {
      console.error('Erro ao buscar cliente:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar cliente',
        message: error.message
      });
    }
  }

  let client;
  
  try {
    const { name, email, cpfCnpj, mobilePhone, userId, externalReference } = req.body;

    // Para atualização, verificar apenas os campos que estão sendo atualizados
    if (!isUpdate && (!name || !email)) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos obrigatórios: name, email' 
      });
    }

    // Configuração da API do Asaas
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    const API_URL = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!ASAAS_API_KEY) {
      return res.status(500).json({ 
        success: false,
        error: 'Chave de API do Asaas não configurada' 
      });
    }

    // Configuração do cliente HTTP
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    // CASO DE ATUALIZAÇÃO: atualizar cliente existente
    if (isUpdate && customerId) {
      console.log(`Atualizando cliente ${customerId} com novos dados`);
      
      // Preparar dados para atualização
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (cpfCnpj) updateData.cpfCnpj = cpfCnpj;
      if (mobilePhone) updateData.mobilePhone = mobilePhone;
      
      // Chamar API para atualizar
      try {
        const updateResponse = await apiClient.post(`/customers/${customerId}`, updateData);
        const updatedCustomer = updateResponse.data;
        
        console.log(`Cliente ${customerId} atualizado com sucesso`);
        
        return res.status(200).json({
          success: true,
          id: updatedCustomer.id,
          customerId: updatedCustomer.id,
          customer: updatedCustomer,
          message: 'Cliente atualizado com sucesso'
        });
      } catch (updateError) {
        console.error(`Erro ao atualizar cliente ${customerId}:`, updateError.message);
        
        // Verificar se o erro é da API do Asaas
        if (updateError.response && updateError.response.data) {
          return res.status(updateError.response.status || 500).json({
            success: false,
            error: 'Erro na API do Asaas ao atualizar cliente',
            details: updateError.response.data
          });
        }
        
        return res.status(500).json({
          success: false,
          error: 'Erro ao atualizar cliente',
          message: updateError.message
        });
      }
    }

    // CASO DE CRIAÇÃO: verificar se o cliente já existe pelo email
    try {
      console.log(`Buscando cliente pelo email: ${email}`);
      const searchResponse = await apiClient.get('/customers', {
        params: { email }
      });

      // Se já existir um cliente com este email, retorná-lo
      if (searchResponse.data.data && searchResponse.data.data.length > 0) {
        const existingCustomer = searchResponse.data.data[0];
        console.log(`Cliente já existe, ID: ${existingCustomer.id}`);

        // Opcionalmente, atualizar dados do cliente se necessário
        const updateData = {
          name,
          mobilePhone
        };
        
        // Adicionar externalReference se foi fornecido
        if (externalReference) {
          updateData.externalReference = externalReference;
        }
        
        // Adicionar cpfCnpj apenas se foi fornecido
        if (cpfCnpj) {
          updateData.cpfCnpj = cpfCnpj;
        }
        
        await apiClient.post(`/customers/${existingCustomer.id}`, updateData);

        // Conectar ao MongoDB e registrar o cliente se necessário
        if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
          try {
            client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
            
            // Verificar se o cliente já existe no MongoDB
            const existingDbCustomer = await db.collection('customers').findOne({ asaas_id: existingCustomer.id });
            
            if (!existingDbCustomer) {
              // Registrar o cliente no MongoDB
              await db.collection('customers').insertOne({
                asaas_id: existingCustomer.id,
                user_id: userId,
                name,
                email,
                cpfCnpj,
                createdAt: new Date()
              });
            }
          } catch (dbError) {
            console.error('Erro ao acessar MongoDB:', dbError.message);
            // Continuar mesmo com erro no MongoDB
          }
        }

        return res.status(200).json({
          success: true,
          id: existingCustomer.id,
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
      notificationDisabled: false
    };
    
    // Adicionar campos opcionais se foram fornecidos
    if (cpfCnpj) customerData.cpfCnpj = cpfCnpj;
    if (mobilePhone) customerData.mobilePhone = mobilePhone;
    if (externalReference) customerData.externalReference = externalReference;

    const createResponse = await apiClient.post('/customers', customerData);
    const newCustomer = createResponse.data;
    console.log(`Novo cliente criado, ID: ${newCustomer.id}`);

    // Conectar ao MongoDB e registrar o novo cliente
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        await db.collection('customers').insertOne({
          asaas_id: newCustomer.id,
          user_id: userId,
          name,
          email,
          cpfCnpj,
          createdAt: new Date()
        });
      } catch (dbError) {
        console.error('Erro ao acessar MongoDB:', dbError.message);
        // Continuar mesmo com erro no MongoDB
      }
    }

    return res.status(200).json({
      success: true,
      id: newCustomer.id,
      customerId: newCustomer.id,
      message: 'Cliente criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar solicitação:', error.message);
    
    // Verificar se o erro é da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({
      success: false,
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