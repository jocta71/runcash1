// Endpoint de criação de cliente usando MongoDB para Vercel
const axios = require('axios');
const { MongoClient } = require('mongodb');
const cors = require('cors')({ origin: true });

module.exports = async (req, res) => {
  // Configuração de CORS
  await new Promise((resolve) => cors(req, res, resolve));

  // Verificação do método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido'
    });
  }

  // Determinar ação a ser executada (criar ou atualizar)
  const action = req.query.action || 'create';

  let client;
  
  try {
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

    // === ATUALIZAR CLIENTE ===
    if (action === 'update') {
      const { customerId, name, email, cpfCnpj, mobilePhone } = req.body;

      // Validar campos obrigatórios
      if (!customerId) {
        return res.status(400).json({ 
          success: false,
          error: 'Campo obrigatório: customerId' 
        });
      }

      // Dados para atualizar o cliente
      const customerData = {};
      
      // Adicionar apenas os campos que foram fornecidos
      if (name) customerData.name = name;
      if (email) customerData.email = email;
      if (cpfCnpj) customerData.cpfCnpj = cpfCnpj;
      if (mobilePhone) customerData.mobilePhone = mobilePhone;

      console.log(`Atualizando cliente ${customerId} no Asaas:`, customerData);
      
      try {
        // Atualizar cliente no Asaas
        const updateResponse = await apiClient.post(`/customers/${customerId}`, customerData);
        const updatedCustomer = updateResponse.data;
        
        console.log(`Cliente atualizado com sucesso:`, {
          id: updatedCustomer.id,
          name: updatedCustomer.name,
          email: updatedCustomer.email,
          cpfCnpj: updatedCustomer.cpfCnpj || 'Não fornecido'
        });

        // Se tiver MongoDB configurado, também atualizar lá
        if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
          try {
            client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
            
            // Atualizar no MongoDB
            await db.collection('customers').updateOne(
              { asaas_id: customerId },
              { 
                $set: {
                  ...customerData,
                  updatedAt: new Date()
                } 
              }
            );
            
            console.log('Cliente atualizado no MongoDB');
          } catch (dbError) {
            console.error('Erro ao acessar MongoDB:', dbError.message);
            // Continuar mesmo com erro no MongoDB
          }
        }

        return res.status(200).json({
          success: true,
          id: updatedCustomer.id,
          message: 'Cliente atualizado com sucesso'
        });
      } catch (updateError) {
        console.error('Erro ao atualizar cliente:', updateError.message);
        
        if (updateError.response && updateError.response.data) {
          return res.status(updateError.response.status || 500).json({
            success: false,
            error: 'Erro na API do Asaas',
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
    // === CRIAR OU RECUPERAR CLIENTE ===
    else {
      const { name, email, cpfCnpj, mobilePhone, userId, externalReference } = req.body;

      // Validar campos obrigatórios - agora exigindo apenas name e email
      if (!name || !email) {
        return res.status(400).json({ 
          success: false,
          error: 'Campos obrigatórios: name, email' 
        });
      }

      // Verificar se o cliente já existe pelo email
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
    }
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