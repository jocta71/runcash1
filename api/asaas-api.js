// API Unificada para todas as operações relacionadas ao Asaas
// Este arquivo consolida várias funções serverless em uma única para respeitar o limite do plano Hobby da Vercel

const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');
const { connectToDatabase } = require('./config/mongodb');

// Função auxiliar para conectar ao MongoDB
// Removida para evitar duplicação, usando a importada de ../config/mongodb

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

  // Extrair o caminho da requisição (do query parameter ou do body)
  // Modificação: Verificar tanto req.query quanto req.body para o parâmetro 'path'
  const path = req.query.path || (req.body && req.body.path) || '';

  console.log(`=== API Asaas - Rota acessada: ${path} ===`);
  console.log('Método:', req.method);
  console.log('Query params:', JSON.stringify(req.query));
  console.log('Headers:', JSON.stringify(req.headers));
  
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Body:', JSON.stringify(req.body));
  }

  // Roteamento baseado no caminho
  try {
    console.log(`Iniciando processamento da rota: ${path}`);
    
    let result;
    switch (path) {
      case 'create-customer':
        result = await handleCreateCustomer(req, res);
        break;
      case 'find-customer':
        result = await handleFindCustomer(req, res);
        break;
      case 'create-subscription':
        result = await handleCreateSubscription(req, res);
        break;
      case 'find-subscription':
        result = await handleFindSubscription(req, res);
        break;
      case 'cancel-subscription':
        result = await handleCancelSubscription(req, res);
        break;
      case 'sync-user-customer':
        result = await handleSyncUserCustomer(req, res);
        break;
      case 'find-payment':
        result = await handleFindPayment(req, res);
        break;
      case 'regenerate-pix-code':
        result = await handleRegeneratePixCode(req, res);
        break;
      case 'pix-qrcode':
        result = await handlePixQrCode(req, res);
        break;
      default:
        console.log(`Rota não encontrada: ${path}`);
        return res.status(404).json({ 
          success: false, 
          error: 'Endpoint não encontrado' 
        });
    }
    return result; // Retornar explicitamente o resultado
  } catch (error) {
    console.error(`Erro na API Asaas (${path}):`, error);
    console.error('Stack trace completo:', error.stack);
    
    // Se a resposta já foi enviada, não tente enviar outra
    if (res.headersSent) {
      console.error('Resposta já foi enviada, ignorando tratamento de erro');
      return;
    }
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      message: error.message,
      path: path,
      method: req.method
    });
  }
};

// Configuração da API do Asaas
function getAsaasConfig() {
  try {
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    
    console.log(`Ambiente Asaas: ${ASAAS_ENVIRONMENT}`);
    console.log(`API Key configurada: ${ASAAS_API_KEY ? 'Sim' : 'Não'}`);
    
    // Verificar se a chave está definida
    if (!ASAAS_API_KEY) {
      console.error('ERRO CRÍTICO: Chave de API do Asaas não configurada no ambiente');
      throw new Error('Chave de API do Asaas não configurada');
    }
    
    // Verificar se a chave parece válida (formato básico)
    if (ASAAS_API_KEY.length < 20) {
      console.error('ERRO CRÍTICO: Chave de API do Asaas parece inválida (muito curta)');
      throw new Error('Chave de API do Asaas parece inválida');
    }
    
    // Log do ambiente
    console.log(`Configurando API Asaas no ambiente: ${ASAAS_ENVIRONMENT}`);
    
    // Definir URL da API com base no ambiente
    const API_URL = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
    
    console.log(`URL da API Asaas: ${API_URL}`);
    
    // Ocultar parte da chave no log por segurança
    const maskedKey = ASAAS_API_KEY.substring(0, 10) + '...' + ASAAS_API_KEY.substring(ASAAS_API_KEY.length - 5);
    console.log(`Usando chave de API: ${maskedKey}`);

    // Configuração do cliente HTTP
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
      // Timeout de 10 segundos para evitar requisições penduradas
      timeout: 10000
    });
    
    // Adicionar interceptor para logar erros detalhados
    apiClient.interceptors.response.use(
      response => response,
      error => {
        console.error('Erro na requisição ao Asaas:');
        console.error('Status:', error.response?.status);
        console.error('Dados:', JSON.stringify(error.response?.data || {}));
        console.error('Config:', JSON.stringify(error.config || {}));
        return Promise.reject(error);
      }
    );

    console.log('Cliente HTTP do Asaas configurado com sucesso');
    return { apiClient, API_URL };
  } catch (error) {
    console.error('Erro ao configurar cliente Asaas:', error);
    console.error('Stack trace:', error.stack);
    throw error; // Re-throw para que o chamador possa tratar
  }
}

// ===== IMPLEMENTAÇÕES DAS FUNÇÕES =====

// 1. Criar cliente no Asaas
async function handleCreateCustomer(req, res) {
  try {
    const { name, email, cpfCnpj, mobilePhone, externalReference } = req.body;

    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parâmetros obrigatórios ausentes: name, email' 
      });
    }

    console.log(`Criando cliente no Asaas para ${name} (${email})`);
    
    const { apiClient, API_URL } = getAsaasConfig();

    // Prepara o payload para criar o cliente
    const customerData = {
      name,
      email,
      externalReference: externalReference || null
    };

    // Adiciona os campos opcionais, se fornecidos
    if (cpfCnpj) customerData.cpfCnpj = cpfCnpj;
    if (mobilePhone) customerData.mobilePhone = mobilePhone;

    console.log('Enviando dados para Asaas:', customerData);

    // Chama a API do Asaas para criar o cliente
    const response = await apiClient.post('/customers', customerData);

    if (response.status !== 200) {
      console.error('Erro na resposta da API Asaas:', response.data);
      return res.status(500).json({ 
        success: false, 
        error: 'Falha ao criar cliente no Asaas' 
      });
    }

    console.log('Cliente criado com sucesso no Asaas:', response.data.id);

    // Se o externalReference for fornecido, tenta atualizar o usuário no MongoDB
    if (externalReference) {
      try {
        console.log('Tentando conectar ao MongoDB para atualizar usuário...');
        const { db } = await connectToDatabase();
        
        await db.collection('users').updateOne(
          { _id: new ObjectId(externalReference) },
          { $set: { asaasCustomerId: response.data.id } }
        );
        
        console.log(`Usuário ${externalReference} atualizado no MongoDB com asaasCustomerId`);
      } catch (dbError) {
        console.error('Erro ao atualizar usuário no MongoDB:', dbError.message);
        console.error(dbError.stack);
        // Continuamos mesmo sem conseguir atualizar o MongoDB
      }
    }

    // Retorna o resultado
    return res.status(200).json({
      success: true,
      customer: response.data,
      message: 'Cliente criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error);
    return res.status(500).json({ 
      success: false, 
      error: `Erro interno: ${error.message}`,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
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
    
    let user = null;
    
    // Tenta conectar ao banco de dados, com tratamento de erro robusto
    let db = null;
    try {
      console.log('Tentando conectar ao MongoDB...');
      const { db: database } = await connectToDatabase();
      db = database;
      
      // Busca o usuário no banco de dados
      user = await db.collection('users').findOne({ 
        _id: new ObjectId(userId) 
      });
      
      console.log('Conexão com MongoDB bem-sucedida');
    } catch (dbError) {
      console.error('Erro ao conectar ao MongoDB:', dbError.message);
      console.error(dbError.stack);
      
      // Se não conseguir conectar ao MongoDB, continuamos mesmo assim
      // Criaremos um objeto user mínimo para prosseguir
      user = {
        _id: userId,
        email: email,
        username: email.split('@')[0]
      };
      
      console.log('Prosseguindo sem conexão MongoDB, usando dados mínimos do usuário');
    }

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
    const sanitizeName = (inputName) => {
      if (!inputName || inputName.length < 3) {
        console.log(`Nome muito curto ou vazio: "${inputName}". Usando parte do email.`);
        return email.split('@')[0]; // Usa parte do email como fallback
      }
      
      // Detecta padrões repetitivos como "aaaaaaa" ou "ffffff"
      const invalidPattern = /^(.)\1{5,}$/;
      if (invalidPattern.test(inputName)) {
        console.log(`Nome com padrão repetitivo detectado: "${inputName}". Usando parte do email.`);
        return email.split('@')[0];
      }
      
      // Verifica se o nome tem muitas letras repetidas consecutivas (como 'ttttttttttaaaaaaa')
      const repeatedCharsPattern = /(.)\1{4,}/;
      if (repeatedCharsPattern.test(inputName)) {
        console.log(`Nome com muitos caracteres repetidos detectado: "${inputName}". Tentando usar nome do usuário.`);
        // Tenta usar o nome de usuário se disponível, ou o nome normalizado, ou parte do email como último recurso
        if (user.username && user.username.length >= 3 && !repeatedCharsPattern.test(user.username)) {
          return user.username;
        }
        
        // Normaliza o nome para evitar repetições excessivas
        const normalizedName = inputName.replace(repeatedCharsPattern, '$1$1$1');
        if (normalizedName.length >= 3) {
          console.log(`Nome normalizado: "${normalizedName}"`);
          return normalizedName;
        }
        
        return email.split('@')[0];
      }
      
      // Remove caracteres especiais e limita o tamanho (Asaas aceita até 60 caracteres)
      const specialCharsPattern = /[^a-zA-Z0-9\s\-_.áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/g;
      return (inputName || '')
        .replace(specialCharsPattern, ' ')
        .trim()
        .substring(0, 60) || email.split('@')[0];
    };

    // Obter nome do request body ou do usuário, e sanitizar
    const name = sanitizeName(req.body.name || user.username);
    console.log(`Nome sanitizado para uso no Asaas: "${name}"`);

    const customerPayload = {
      name,
      email,
      externalReference: userId
    };

    console.log('Criando cliente no Asaas:', customerPayload);

    try {
      console.log('Enviando requisição para criar cliente no Asaas:', customerPayload);
      const createCustomerResponse = await apiClient.post(`/customers`, customerPayload);
      console.log('Resposta da API Asaas (criar cliente):', JSON.stringify(createCustomerResponse.data));

      if (createCustomerResponse.status !== 200 || !createCustomerResponse.data || !createCustomerResponse.data.id) {
        console.log('Falha na criação do cliente no Asaas', JSON.stringify(createCustomerResponse.data || 'Sem dados na resposta'));
        return res.status(500).json({ 
          success: false, 
          error: 'Falha ao criar o cliente no Asaas',
          details: createCustomerResponse.data || 'Resposta sem dados'
        });
      }

      const asaasCustomerId = createCustomerResponse.data.id;
      console.log(`Cliente criado no Asaas com ID: ${asaasCustomerId}`);

      // Tenta atualizar o usuário com o ID do cliente Asaas, se o MongoDB estiver disponível
      if (db) {
        try {
          await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { asaasCustomerId } }
          );
          console.log(`Usuário ${userId} atualizado no MongoDB com asaasCustomerId`);
        } catch (updateError) {
          console.error('Erro ao atualizar usuário no MongoDB:', updateError.message);
          console.error(updateError.stack);
          // Continuamos mesmo sem conseguir atualizar o MongoDB
        }
      } else {
        console.log('Pulando atualização no MongoDB pois a conexão não está disponível');
      }

      // Retorna o resultado
      return res.status(200).json({
        success: true,
        asaasCustomerId,
        message: 'Cliente criado no Asaas com sucesso'
      });
    } catch (asaasError) {
      console.error('Erro na API do Asaas:');
      console.error('Mensagem:', asaasError.message);
      console.error('Dados da resposta:', JSON.stringify(asaasError.response?.data || {}));
      
      // Verificar erros específicos do Asaas
      let errorMessage = 'Erro ao comunicar com API do Asaas';
      
      if (asaasError.response?.data?.errors?.description) {
        errorMessage = `Erro do Asaas: ${asaasError.response.data.errors.description}`;
      } else if (asaasError.response?.data?.errors) {
        // Verificar se há erros nos campos
        const fieldErrors = Object.entries(asaasError.response.data.errors)
          .map(([field, error]) => `${field}: ${error}`)
          .join(', ');
        
        if (fieldErrors) {
          errorMessage = `Erros de validação: ${fieldErrors}`;
        }
      }
      
      return res.status(500).json({ 
        success: false, 
        error: errorMessage,
        details: asaasError.response?.data || asaasError.message
      });
    }
  } catch (error) {
    console.error('Erro ao sincronizar usuário com Asaas:', error);
    return res.status(500).json({ 
      success: false, 
      error: `Erro interno: ${error.message}`,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
}

async function handleFindPayment(req, res) {
  try {
    // Apenas aceitar solicitações GET
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Método não permitido' });
    }
    
    const { paymentId, subscriptionId, customerId, _t } = req.query;
    
    // Verificar se é uma requisição forçada (com cache buster)
    const forceUpdate = !!_t;
    if (forceUpdate) {
      console.log(`Requisição forçada detectada (timestamp: ${_t})`);
    }

    // Validar campos obrigatórios
    if (!paymentId && !subscriptionId && !customerId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar paymentId, subscriptionId ou customerId' 
      });
    }

    const { apiClient } = getAsaasConfig();
    
    // Modificar cliente HTTP para adicionar controle de cache se necessário
    if (forceUpdate) {
      apiClient.defaults.headers['Cache-Control'] = 'no-cache, no-store';
    }

    let paymentsData = [];
    let qrCode = null;

    // Buscar pagamento específico ou lista de pagamentos
    if (paymentId) {
      console.log(`Buscando pagamento específico: ${paymentId} ${forceUpdate ? '(força atualização)' : ''}`);
      
      // Obter parâmetros de URL para verificação forçada
      const params = forceUpdate ? { nocache: Date.now() } : {};
      const paymentResponse = await apiClient.get(`/payments/${paymentId}`, { params });
      paymentsData = [paymentResponse.data];
      
      // Se o pagamento for PIX, buscar QR Code
      if (paymentResponse.data.billingType === 'PIX') {
        try {
          const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`, { params });
          qrCode = {
            encodedImage: pixResponse.data.encodedImage,
            payload: pixResponse.data.payload
          };
        } catch (pixError) {
          console.error('Erro ao obter QR Code PIX:', pixError.message);
        }
      }
    } else if (subscriptionId) {
      console.log(`Buscando pagamentos da assinatura: ${subscriptionId}`);
      const paymentsResponse = await apiClient.get('/payments', {
        params: { subscription: subscriptionId, ...(forceUpdate ? { nocache: Date.now() } : {}) }
      });
      paymentsData = paymentsResponse.data.data || [];
    } else if (customerId) {
      console.log(`Buscando pagamentos do cliente: ${customerId}`);
      const paymentsResponse = await apiClient.get('/payments', {
        params: { customer: customerId, ...(forceUpdate ? { nocache: Date.now() } : {}) }
      });
      paymentsData = paymentsResponse.data.data || [];
    }

    // Formatar resposta
    const formattedPayments = paymentsData.map(payment => ({
      id: payment.id,
      status: payment.status,
      value: payment.value,
      netValue: payment.netValue,
      billingType: payment.billingType,
      dueDate: payment.dueDate,
      paymentDate: payment.paymentDate,
      description: payment.description,
      invoiceUrl: payment.invoiceUrl,
      externalReference: payment.externalReference,
      subscription: payment.subscription,
      customer: payment.customer
    }));

    return res.status(200).json({
      success: true,
      payment: formattedPayments[0] || null, // Retornar o primeiro pagamento ou null
      payments: formattedPayments,
      qrCode: qrCode
    });
  } catch (error) {
    console.error('Erro ao buscar pagamento:', error.message);
    
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
      error: 'Erro ao buscar pagamento',
      message: error.message
    });
  }
}

async function handleRegeneratePixCode(req, res) {
  try {
    // Aceitar solicitações GET (para uso direto) e POST (para chamadas de API)
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ 
        success: false,
        error: 'Método não permitido' 
      });
    }
    
    // Obter paymentId ou subscriptionId da query ou body
    let paymentId = null;
    let subscriptionId = null;
    
    if (req.method === 'GET') {
      paymentId = req.query.paymentId;
      subscriptionId = req.query.subscriptionId;
    } else {
      paymentId = req.body.paymentId;
      subscriptionId = req.body.subscriptionId;
    }

    // Precisamos de pelo menos um dos IDs
    if (!paymentId && !subscriptionId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar paymentId ou subscriptionId' 
      });
    }

    const { apiClient } = getAsaasConfig();

    // Se temos apenas o subscriptionId, precisamos buscar o paymentId
    if (!paymentId && subscriptionId) {
      console.log(`Buscando pagamento para assinatura ${subscriptionId}...`);
      
      try {
        const paymentsResponse = await apiClient.get('/payments', {
          params: { subscription: subscriptionId }
        });
        
        if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
          // Pegar o pagamento mais recente
          paymentId = paymentsResponse.data.data[0].id;
          console.log(`Pagamento encontrado: ${paymentId}`);
        } else {
          return res.status(404).json({
            success: false,
            error: 'Nenhum pagamento encontrado para esta assinatura'
          });
        }
      } catch (searchError) {
        console.error('Erro ao buscar pagamento:', searchError.message);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar pagamento',
          details: searchError.message
        });
      }
    }

    // Agora que temos o paymentId, buscar informações do pagamento
    console.log(`Verificando se o pagamento ${paymentId} é do tipo PIX...`);
    
    let payment;
    try {
      const paymentResponse = await apiClient.get(`/payments/${paymentId}`);
      payment = paymentResponse.data;
      
      if (payment.billingType !== 'PIX') {
        return res.status(400).json({
          success: false,
          error: 'Este pagamento não é do tipo PIX'
        });
      }
      
      if (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED') {
        return res.status(400).json({
          success: false,
          error: 'Este pagamento já foi confirmado'
        });
      }
      
      console.log(`Pagamento PIX válido. Status: ${payment.status}`);
    } catch (paymentError) {
      console.error('Erro ao verificar pagamento:', paymentError.message);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar pagamento',
        details: paymentError.message
      });
    }
    
    // Gerar QR Code PIX
    console.log(`Gerando QR Code PIX para o pagamento ${paymentId}...`);
    
    try {
      const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
      
      console.log('QR Code PIX gerado com sucesso!');
      
      // Retornar QR Code e informações do pagamento
      return res.status(200).json({
        success: true,
        payment: {
          id: payment.id,
          value: payment.value,
          status: payment.status,
          dueDate: payment.dueDate,
          description: payment.description
        },
        qrCode: {
          encodedImage: pixResponse.data.encodedImage,
          payload: pixResponse.data.payload,
          expirationDate: pixResponse.data.expirationDate
        }
      });
    } catch (pixError) {
      console.error('Erro ao gerar QR Code PIX:', pixError.message);
      
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar QR Code PIX',
        details: pixError.message
      });
    }
  } catch (error) {
    console.error('Erro inesperado:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Erro inesperado',
      message: error.message
    });
  }
}

async function handlePixQrCode(req, res) {
  try {
    // Aceitar solicitações GET e POST
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ 
        success: false,
        error: 'Método não permitido' 
      });
    }
    
    // Obter ID do pagamento da query (GET) ou body (POST)
    let paymentId;
    
    if (req.method === 'GET') {
      paymentId = req.query.paymentId;
    } else {
      paymentId = req.body.paymentId;
    }

    // Validar campos obrigatórios
    if (!paymentId) {
      return res.status(400).json({ 
        success: false,
        error: 'Campo obrigatório: paymentId' 
      });
    }

    const { apiClient } = getAsaasConfig();

    // Verificar se o pagamento existe e é do tipo PIX
    console.log(`Verificando pagamento: ${paymentId}`);
    const paymentResponse = await apiClient.get(`/payments/${paymentId}`);
    const payment = paymentResponse.data;
    
    if (payment.billingType !== 'PIX') {
      return res.status(400).json({
        success: false,
        error: 'O pagamento não é do tipo PIX'
      });
    }
    
    // Gerar QR code PIX
    console.log(`Gerando QR code PIX para o pagamento: ${paymentId}`);
    const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
    
    // Extrair dados do QR code
    const qrCode = {
      encodedImage: pixResponse.data.encodedImage,
      payload: pixResponse.data.payload,
      expirationDate: pixResponse.data.expirationDate
    };
    
    // Informações adicionais do pagamento
    const paymentInfo = {
      id: payment.id,
      value: payment.value,
      status: payment.status,
      dueDate: payment.dueDate,
      description: payment.description
    };
    
    // Retornar resposta com QR code e dados do pagamento
    return res.status(200).json({
      success: true,
      qrCode,
      payment: paymentInfo
    });
  } catch (error) {
    console.error('Erro ao gerar QR code PIX:', error.message);
    
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
      error: 'Erro ao gerar QR code PIX',
      message: error.message
    });
  }
} 