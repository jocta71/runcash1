// Endpoint de criação de cliente usando MongoDB para Vercel
const axios = require('axios');
const { MongoClient } = require('mongodb');
const cors = require('cors')({ origin: true });

module.exports = async (req, res) => {
  // Log para depuração
  console.log('Iniciando endpoint asaas-create-customer com método:', req.method);
  console.log('Query params:', req.query);
  console.log('Body recebido:', {
    ...req.body,
    // Omitir campos sensíveis
    cpfCnpj: req.body.cpfCnpj ? '***omitido***' : undefined
  });

  // Configuração de CORS
  try {
    await new Promise((resolve) => cors(req, res, resolve));
  } catch (corsError) {
    console.error('Erro ao configurar CORS:', corsError);
    return res.status(500).json({
      success: false,
      error: 'Erro interno no servidor - CORS'
    });
  }

  // Verificação do método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido'
    });
  }

  // Determinar ação a ser executada (criar ou atualizar)
  const action = req.query.action || 'create';
  console.log(`Ação solicitada: ${action}`);

  let client;
  
  try {
    // Verificar variáveis de ambiente
    console.log('Verificando variáveis de ambiente...');
    
    // Configuração da API do Asaas
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    
    if (!ASAAS_API_KEY) {
      console.error('ERRO: ASAAS_API_KEY não configurada');
      return res.status(500).json({ 
        success: false,
        error: 'Chave de API do Asaas não configurada' 
      });
    }
    
    console.log(`Ambiente Asaas: ${ASAAS_ENVIRONMENT}`);
    
    const API_URL = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

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

      console.log(`Atualizando cliente ${customerId} no Asaas:`, {
        ...customerData,
        cpfCnpj: cpfCnpj ? '***omitido***' : undefined
      });
      
      try {
        // Atualizar cliente no Asaas
        console.log(`Fazendo requisição para: ${API_URL}/customers/${customerId}`);
        const updateResponse = await apiClient.post(`/customers/${customerId}`, customerData);
        const updatedCustomer = updateResponse.data;
        
        console.log(`Cliente atualizado com sucesso:`, {
          id: updatedCustomer.id,
          name: updatedCustomer.name,
          email: updatedCustomer.email,
          cpfCnpj: updatedCustomer.cpfCnpj ? '***omitido***' : 'Não fornecido'
        });

        // Verificar a configuração do MongoDB
        const mongoEnabled = process.env.MONGODB_ENABLED === 'true';
        const mongoUri = process.env.MONGODB_URI;
        const mongoDbName = process.env.MONGODB_DB_NAME || 'runcash';
        
        console.log(`MongoDB habilitado: ${mongoEnabled}, URI configurada: ${!!mongoUri}`);
        
        // Se tiver MongoDB configurado, também atualizar lá
        if (mongoEnabled && mongoUri) {
          try {
            console.log('Conectando ao MongoDB...');
            client = new MongoClient(mongoUri);
            await client.connect();
            console.log('Conexão com MongoDB estabelecida');
            
            const db = client.db(mongoDbName);
            
            // Atualizar no MongoDB
            const result = await db.collection('customers').updateOne(
              { asaas_id: customerId },
              { 
                $set: {
                  ...customerData,
                  updatedAt: new Date()
                } 
              }
            );
            
            console.log('Cliente atualizado no MongoDB:', result.matchedCount ? 'Encontrado e atualizado' : 'Não encontrado');
          } catch (dbError) {
            console.error('Erro ao acessar MongoDB:', dbError.message);
            // Continuar mesmo com erro no MongoDB
          }
        }

        return res.status(200).json({
          success: true,
          data: {
            customerId: updatedCustomer.id
          },
          message: 'Cliente atualizado com sucesso'
        });
      } catch (updateError) {
        console.error('Erro ao atualizar cliente:', updateError.message);
        
        if (updateError.response) {
          console.error('Resposta de erro do Asaas:', {
            status: updateError.response.status,
            data: updateError.response.data
          });
          
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

        console.log('Resposta da busca de cliente:', {
          status: searchResponse.status,
          resultCount: searchResponse.data.data ? searchResponse.data.data.length : 0
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
          
          console.log(`Atualizando dados do cliente existente: ${existingCustomer.id}`);
          await apiClient.post(`/customers/${existingCustomer.id}`, updateData);

          // Verificar a configuração do MongoDB
          const mongoEnabled = process.env.MONGODB_ENABLED === 'true';
          const mongoUri = process.env.MONGODB_URI;
          const mongoDbName = process.env.MONGODB_DB_NAME || 'runcash';
          
          // Se tiver MongoDB configurado, também atualizar lá
          if (mongoEnabled && mongoUri) {
            try {
              console.log('Conectando ao MongoDB...');
              client = new MongoClient(mongoUri);
              await client.connect();
              const db = client.db(mongoDbName);
              
              // Verificar se o cliente já existe no MongoDB
              const existingDbCustomer = await db.collection('customers').findOne({ asaas_id: existingCustomer.id });
              
              if (!existingDbCustomer) {
                // Registrar o cliente no MongoDB
                console.log('Cliente não encontrado no MongoDB, registrando...');
                await db.collection('customers').insertOne({
                  asaas_id: existingCustomer.id,
                  user_id: userId,
                  name,
                  email,
                  cpfCnpj,
                  createdAt: new Date()
                });
                console.log('Cliente registrado no MongoDB');
              } else {
                console.log('Cliente já existe no MongoDB');
              }
            } catch (dbError) {
              console.error('Erro ao acessar MongoDB:', dbError.message);
              // Continuar mesmo com erro no MongoDB
            }
          }

          return res.status(200).json({
            success: true,
            data: {
              customerId: existingCustomer.id
            },
            message: 'Cliente recuperado e atualizado com sucesso'
          });
        }
      } catch (searchError) {
        console.error('Erro ao buscar cliente:', searchError.message);
        
        if (searchError.response) {
          console.error('Resposta de erro da busca:', {
            status: searchError.response.status,
            data: searchError.response.data
          });
        }
        
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

      try {
        const createResponse = await apiClient.post('/customers', customerData);
        const newCustomer = createResponse.data;
        console.log(`Novo cliente criado, ID: ${newCustomer.id}`);

        // Verificar a configuração do MongoDB
        const mongoEnabled = process.env.MONGODB_ENABLED === 'true';
        const mongoUri = process.env.MONGODB_URI;
        const mongoDbName = process.env.MONGODB_DB_NAME || 'runcash';
        
        // Conectar ao MongoDB e registrar o novo cliente
        if (mongoEnabled && mongoUri) {
          try {
            console.log('Conectando ao MongoDB para registrar novo cliente...');
            client = new MongoClient(mongoUri);
            await client.connect();
            const db = client.db(mongoDbName);
            
            await db.collection('customers').insertOne({
              asaas_id: newCustomer.id,
              user_id: userId,
              name,
              email,
              cpfCnpj,
              createdAt: new Date()
            });
            console.log('Novo cliente registrado no MongoDB');
          } catch (dbError) {
            console.error('Erro ao acessar MongoDB:', dbError.message);
            // Continuar mesmo com erro no MongoDB
          }
        }

        return res.status(200).json({
          success: true,
          data: {
            customerId: newCustomer.id
          },
          message: 'Cliente criado com sucesso'
        });
      } catch (createError) {
        console.error('Erro ao criar cliente:', createError.message);
        
        if (createError.response) {
          console.error('Resposta de erro da criação:', {
            status: createError.response.status,
            data: createError.response.data
          });
          
          return res.status(createError.response.status || 500).json({
            success: false,
            error: 'Erro na criação do cliente na API do Asaas',
            details: createError.response.data
          });
        }
        
        throw createError; // Propagar para o tratamento genérico
      }
    }
  } catch (error) {
    console.error('Erro geral ao processar solicitação:', error.message);
    
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
      try {
        await client.close();
        console.log('Conexão com MongoDB fechada');
      } catch (closeError) {
        console.error('Erro ao fechar conexão com MongoDB:', closeError.message);
      }
    }
  }
}; 