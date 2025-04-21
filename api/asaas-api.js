// API Unificada para todas as operações relacionadas ao Asaas
// Este arquivo consolida várias funções serverless em uma única para respeitar o limite do plano Hobby da Vercel

const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');
const { connectToDatabase } = require('../config/mongodb');

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

  // Extrair o caminho da requisição
  const path = req.query.path || '';

  console.log(`Rota acessada: ${path}`);

  // Roteamento baseado no caminho
  try {
    switch (path) {
      case 'create-customer':
        return await handleCreateCustomer(req, res);
      case 'find-customer':
        return await handleFindCustomer(req, res);
      case 'create-subscription':
        return await handleCreateSubscription(req, res);
      case 'find-subscription':
        return await handleFindSubscription(req, res);
      case 'cancel-subscription':
        return await handleCancelSubscription(req, res);
      case 'sync-user-customer':
        return await handleSyncUserCustomer(req, res);
      default:
        return res.status(404).json({ 
          success: false, 
          error: 'Endpoint não encontrado' 
        });
    }
  } catch (error) {
    console.error(`Erro na API Asaas (${path}):`, error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      message: error.message
    });
  }
};

// Configuração da API do Asaas
function getAsaasConfig() {
  const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
  const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
  const API_URL = ASAAS_ENVIRONMENT === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  if (!ASAAS_API_KEY) {
    throw new Error('Chave de API do Asaas não configurada');
  }

  // Configuração do cliente HTTP
  const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
      'access_token': ASAAS_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return { apiClient, API_URL };
}

// ===== IMPLEMENTAÇÕES DAS FUNÇÕES =====

// 1. Criar cliente no Asaas
async function handleCreateCustomer(req, res) {
  let client;
  
  try {
    const { name, email, cpfCnpj, mobilePhone, userId } = req.body;

    // Validar campos obrigatórios
    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos obrigatórios: name, email, cpfCnpj' 
      });
    }

    const { apiClient } = getAsaasConfig();

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
          data: {
            customerId: existingCustomer.id
          },
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
      data: {
        customerId: newCustomer.id
      },
      message: 'Cliente criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar solicitação create-customer:', error.message);
    
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
}

// 2. Buscar cliente no Asaas
async function handleFindCustomer(req, res) {
  try {
    const { customerId, cpfCnpj, email } = req.query;

    // Validar campos obrigatórios
    if (!customerId && !cpfCnpj && !email) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar customerId, cpfCnpj ou email' 
      });
    }

    const { apiClient } = getAsaasConfig();

    let customer = null;
    let subscriptions = [];

    // Buscar cliente por ID, CPF/CNPJ ou email
    if (customerId) {
      console.log(`Buscando cliente por ID: ${customerId}`);
      const customerResponse = await apiClient.get(`/customers/${customerId}`);
      customer = customerResponse.data;
    } else if (cpfCnpj || email) {
      console.log(`Buscando cliente por ${cpfCnpj ? 'CPF/CNPJ' : 'email'}: ${cpfCnpj || email}`);
      const searchParams = cpfCnpj ? { cpfCnpj } : { email };
      
      const customersResponse = await apiClient.get('/customers', {
        params: searchParams
      });
      
      if (customersResponse.data.data && customersResponse.data.data.length > 0) {
        customer = customersResponse.data.data[0];
      } else {
        return res.status(404).json({
          success: false,
          error: 'Cliente não encontrado'
        });
      }
    }

    // Se encontrou cliente, buscar também suas assinaturas
    if (customer && customer.id) {
      try {
        const subscriptionsResponse = await apiClient.get('/subscriptions', {
          params: { customer: customer.id }
        });
        
        if (subscriptionsResponse.data.data) {
          subscriptions = subscriptionsResponse.data.data.map(sub => ({
            id: sub.id,
            status: sub.status,
            value: sub.value,
            nextDueDate: sub.nextDueDate,
            cycle: sub.cycle,
            billingType: sub.billingType,
            description: sub.description
          }));
        }
      } catch (error) {
        console.log('Erro ao buscar assinaturas do cliente:', error.message);
        // Continuar sem as assinaturas
      }
    }

    // Formatar a resposta
    const formattedCustomer = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      cpfCnpj: customer.cpfCnpj,
      mobilePhone: customer.mobilePhone,
      dateCreated: customer.dateCreated
    };

    return res.status(200).json({
      success: true,
      customer: formattedCustomer,
      subscriptions
    });
  } catch (error) {
    console.error('Erro ao buscar cliente:', error.message);
    
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
      error: 'Erro ao buscar cliente',
      message: error.message
    });
  }
}

// 3. Criar assinatura no Asaas
async function handleCreateSubscription(req, res) {
  try {
    const { 
      customerId, 
      planId, 
      userId,
      billingType = 'PIX', 
      cycle = 'MONTHLY',
      description,
      value,
      creditCard,
      creditCardHolderInfo,
      nextDueDate
    } = req.body;

    // Validar campos obrigatórios
    if (!customerId || !planId) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos obrigatórios: customerId, planId' 
      });
    }

    // Valores oficiais dos planos
    const planValues = {
      'basic': 19.90,
      'pro': 49.90,
      'premium': 99.90
    };

    // Usar o valor do plano se não foi especificado
    const subscriptionValue = value || planValues[planId] || 19.90;

    // Construir dados da assinatura
    const subscriptionData = {
      customer: customerId,
      billingType,
      cycle,
      value: subscriptionValue,
      description: description || `Assinatura RunCash - Plano ${planId.toUpperCase()}`,
      nextDueDate: nextDueDate || null,
      
      // O campo fine (multa) é opcional
      // fine: { value: 0.1 }, // Exemplo: 10% de multa por atraso
      
      // O campo interest (juros) também é opcional
      // interest: { value: 2 }, // Exemplo: 2% de juros ao mês por atraso
    };

    // Se for cartão de crédito, adicionar informações necessárias
    if (billingType === 'CREDIT_CARD' && creditCard) {
      // No caso do cartão de crédito, poderíamos ter uma tokenização
      // mas por enquanto, vamos adicionar apenas informações básicas
      subscriptionData.creditCard = {
        holderName: creditCard.holderName,
        number: creditCard.number,
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv
      };

      // Adicionar informações do titular, se fornecidas
      if (creditCardHolderInfo) {
        subscriptionData.creditCardHolderInfo = {
          name: creditCardHolderInfo.name || creditCard.holderName,
          email: creditCardHolderInfo.email,
          cpfCnpj: creditCardHolderInfo.cpfCnpj,
          postalCode: creditCardHolderInfo.postalCode,
          addressNumber: creditCardHolderInfo.addressNumber,
          phone: creditCardHolderInfo.phone
        };
      }
    }

    // Para PIX, configurar um callback URL para notificações
    if (billingType === 'PIX') {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : process.env.API_BASE_URL || 'https://runcashh11.vercel.app';
      
      subscriptionData.callbackUrl = `${baseUrl}/api/asaas-webhook?userId=${userId}&planId=${planId}`;
    }

    console.log(`Criando assinatura para cliente ${customerId}, plano ${planId}, método ${billingType}`);

    const { apiClient } = getAsaasConfig();
    const response = await apiClient.post('/subscriptions', subscriptionData);

    // Verificar se a criação da assinatura foi bem-sucedida
    if (!response.data || !response.data.id) {
      return res.status(500).json({
        success: false,
        error: 'Falha ao criar assinatura no Asaas'
      });
    }

    const subscription = response.data;
    console.log(`Assinatura criada com sucesso: ${subscription.id}`);

    // Buscar o primeiro pagamento da assinatura, que contém o QR code do PIX, se aplicável
    let payment = null;
    let qrCode = null;

    try {
      if (billingType === 'PIX') {
        const paymentsResponse = await apiClient.get('/payments', {
          params: { subscription: subscription.id }
        });
        
        if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
          payment = paymentsResponse.data.data[0];
          
          // Obter o QR code e link de pagamento para PIX
          const paymentId = payment.id;
          const pixInfoResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
          
          if (pixInfoResponse.data && pixInfoResponse.data.encodedImage) {
            qrCode = {
              encodedImage: pixInfoResponse.data.encodedImage,
              payload: pixInfoResponse.data.payload,
              expirationDate: pixInfoResponse.data.expirationDate
            };
          }
        }
      }
    } catch (paymentError) {
      console.error('Erro ao buscar informações de pagamento:', paymentError.message);
      // Continuar mesmo sem as informações de pagamento, já que a assinatura foi criada
    }

    // Registrar assinatura no MongoDB, se configurado
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        await db.collection('subscriptions').insertOne({
          asaas_id: subscription.id,
          user_id: userId,
          customer_id: customerId,
          plan_id: planId,
          status: subscription.status,
          value: subscription.value,
          payment_method: billingType,
          created_at: new Date()
        });
        
        await client.close();
      } catch (dbError) {
        console.error('Erro ao registrar assinatura no MongoDB:', dbError.message);
        // Continuar mesmo com erro no MongoDB
      }
    }

    // Formatar resposta
    return res.status(200).json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        value: subscription.value,
        paymentId: payment ? payment.id : null,
        paymentUrl: payment ? payment.invoiceUrl : null,
        qrCode
      },
      message: 'Assinatura criada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar assinatura:', error.message);
    
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
      error: 'Erro ao criar assinatura',
      message: error.message
    });
  }
}

// 4. Buscar informações de assinaturas
async function handleFindSubscription(req, res) {
  try {
    const { subscriptionId, customerId } = req.query;

    // Validar campos obrigatórios
    if (!subscriptionId && !customerId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar subscriptionId ou customerId' 
      });
    }

    const { apiClient } = getAsaasConfig();

    let subscriptionsData = [];
    let payments = [];

    // Buscar assinatura específica ou lista de assinaturas
    if (subscriptionId) {
      console.log(`Buscando assinatura específica: ${subscriptionId}`);
      const subscriptionResponse = await apiClient.get(`/subscriptions/${subscriptionId}`);
      subscriptionsData = [subscriptionResponse.data];
      
      // Buscar pagamentos associados à assinatura
      try {
        const paymentsResponse = await apiClient.get('/payments', {
          params: { subscription: subscriptionId }
        });
        
        payments = paymentsResponse.data.data || [];
      } catch (paymentsError) {
        console.error('Erro ao buscar pagamentos da assinatura:', paymentsError.message);
      }
    } else if (customerId) {
      console.log(`Buscando assinaturas do cliente: ${customerId}`);
      const subscriptionsResponse = await apiClient.get('/subscriptions', {
        params: { customer: customerId }
      });
      subscriptionsData = subscriptionsResponse.data.data || [];
    }

    // Formatar resposta
    const formattedSubscriptions = subscriptionsData.map(subscription => ({
      id: subscription.id,
      customer: subscription.customer,
      status: subscription.status,
      value: subscription.value,
      nextDueDate: subscription.nextDueDate,
      cycle: subscription.cycle,
      billingType: subscription.billingType,
      description: subscription.description,
      createdDate: subscription.dateCreated
    }));

    // Formatar pagamentos, se disponíveis
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      status: payment.status,
      value: payment.value,
      dueDate: payment.dueDate,
      billingType: payment.billingType,
      invoiceUrl: payment.invoiceUrl
    }));

    return res.status(200).json({
      success: true,
      subscriptions: formattedSubscriptions,
      payments: formattedPayments.length > 0 ? formattedPayments : undefined
    });
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error.message);
    
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
      error: 'Erro ao buscar assinatura',
      message: error.message
    });
  }
}

// 5. Cancelar assinatura
async function handleCancelSubscription(req, res) {
  try {
    const { subscriptionId } = req.body;

    // Validar campos obrigatórios
    if (!subscriptionId) {
      return res.status(400).json({ 
        success: false,
        error: 'Campo obrigatório: subscriptionId' 
      });
    }

    const { apiClient } = getAsaasConfig();

    // Verificar se a assinatura existe
    try {
      await apiClient.get(`/subscriptions/${subscriptionId}`);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'Assinatura não encontrada'
      });
    }

    // Cancelar a assinatura
    console.log(`Cancelando assinatura: ${subscriptionId}`);
    const response = await apiClient.post(`/subscriptions/${subscriptionId}/cancel`);

    // Registrar cancelamento no MongoDB, se configurado
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        await db.collection('subscriptions').updateOne(
          { asaas_id: subscriptionId },
          { 
            $set: { 
              status: 'CANCELLED',
              cancelled_at: new Date()
            } 
          }
        );
        
        await client.close();
      } catch (dbError) {
        console.error('Erro ao registrar cancelamento no MongoDB:', dbError.message);
        // Continuar mesmo com erro no MongoDB
      }
    }

    return res.status(200).json({
      success: true,
      data: response.data,
      message: 'Assinatura cancelada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error.message);
    
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
      error: 'Erro ao cancelar assinatura',
      message: error.message
    });
  }
}

// 6. Sincronizar usuário com cliente Asaas
async function handleSyncUserCustomer(req, res) {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parâmetros obrigatórios ausentes: userId, email' 
      });
    }

    console.log(`Sincronizando usuário ${userId} com o Asaas`);
    
    // Conecta ao banco de dados
    const { db } = await connectToDatabase();
    
    // Busca o usuário no banco de dados
    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(userId) 
    });

    if (!user) {
      console.log(`Usuário ${userId} não encontrado`);
      return res.status(404).json({ 
        success: false, 
        error: 'Usuário não encontrado' 
      });
    }

    const { apiClient, API_URL } = getAsaasConfig();

    // Verifica se o usuário já possui um asaasCustomerId
    if (user.asaasCustomerId) {
      console.log(`Usuário ${userId} já possui um Asaas Customer ID: ${user.asaasCustomerId}`);
      
      // Tenta verificar se o cliente existe no Asaas
      try {
        const verificationResponse = await apiClient.get(`/customers/${user.asaasCustomerId}`);
        
        if (verificationResponse.status === 200) {
          console.log(`Cliente ${user.asaasCustomerId} verificado no Asaas`);
          return res.status(200).json({ 
            success: true, 
            asaasCustomerId: user.asaasCustomerId,
            message: 'Cliente já existente e validado no Asaas'
          });
        }
      } catch (error) {
        console.log(`Erro ao verificar cliente no Asaas: ${error.message}`);
        // Continua com a criação de um novo cliente se a verificação falhar
      }
    }

    // Cria um novo cliente no Asaas
    const name = user.username || email.split('@')[0];
    const customerPayload = {
      name,
      email,
      externalReference: userId
    };

    console.log('Criando cliente no Asaas:', customerPayload);

    const createCustomerResponse = await apiClient.post(`/customers`, customerPayload);

    if (createCustomerResponse.status !== 200) {
      console.log('Falha na criação do cliente no Asaas', createCustomerResponse.data);
      return res.status(500).json({ 
        success: false, 
        error: 'Falha ao criar o cliente no Asaas' 
      });
    }

    const asaasCustomerId = createCustomerResponse.data.id;
    console.log(`Cliente criado no Asaas com ID: ${asaasCustomerId}`);

    // Atualiza o usuário com o ID do cliente Asaas
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { asaasCustomerId } }
    );

    // Retorna o resultado
    return res.status(200).json({
      success: true,
      asaasCustomerId,
      message: 'Usuário sincronizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao sincronizar usuário com Asaas:', error);
    return res.status(500).json({ 
      success: false, 
      error: `Erro interno: ${error.message}` 
    });
  }
} 