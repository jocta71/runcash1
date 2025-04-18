const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configuração do MongoDB e variáveis de ambiente
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_jwt';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_ENVIRONMENT === 'sandbox' 
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://www.asaas.com/api/v3';

// Verificar token de autenticação
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// Configuração de CORS (Helper)
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
};

// Validação do usuário (Helper)
const validateUser = async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Token de autenticação não fornecido', status: 401 };
  }
  
  const token = authHeader.substring(7); // Remover "Bearer " do início
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return { error: 'Token inválido ou expirado', status: 401 };
  }
  
  const userId = decoded.id || decoded.userId || decoded.sub;
  
  if (!userId) {
    return { error: 'ID de usuário não encontrado no token', status: 401 };
  }
  
  return { userId, decoded };
};

// Cliente para API do ASAAS
const asaasClient = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'access_token': ASAAS_API_KEY,
    'Content-Type': 'application/json'
  }
});

// Handler principal
module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS
  setCorsHeaders(res);

  // Responder a solicitações preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Extrair o caminho da URL
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  
  // Ignorar o segmento "api" (o primeiro) e "asaas" (o segundo)
  const operation = pathSegments[2] || '';
  
  // Para a maioria das operações, verificar autenticação (exceto webhook)
  let userId;
  if (operation !== 'webhook') {
    const userValidation = await validateUser(req, res);
    if (userValidation.error) {
      return res.status(userValidation.status).json({ error: userValidation.error });
    }
    userId = userValidation.userId;
  }
  
  let client;
  
  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    // Roteamento com base na operação
    switch(operation) {
      case 'create-customer':
        // Lógica da função asaas-create-customer.js
        return await handleCreateCustomer(req, res, db, userId);
        
      case 'find-customer':
        // Lógica da função asaas-find-customer.js
        return await handleFindCustomer(req, res, db, userId);
        
      case 'create-subscription':
        // Lógica da função asaas-create-subscription.js
        return await handleCreateSubscription(req, res, db, userId);
        
      case 'cancel-subscription':
        // Lógica da função asaas-cancel-subscription.js
        return await handleCancelSubscription(req, res, db, userId);
        
      case 'find-subscription':
        // Lógica da função asaas-find-subscription.js
        return await handleFindSubscription(req, res, db, userId);
        
      case 'find-payment':
        // Lógica da função asaas-find-payment.js
        return await handleFindPayment(req, res);
        
      case 'pix-qrcode':
        // Lógica da função asaas-pix-qrcode.js
        return await handlePixQrcode(req, res);
        
      case 'webhook':
        // Lógica da função asaas-webhook.js
        return await handleWebhook(req, res, db);
        
      default:
        return res.status(404).json({ error: 'Operação do Asaas não encontrada' });
    }
  } catch (error) {
    console.error('Erro na API Asaas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (client) {
      await client.close();
    }
  }
};

// Funções específicas para cada operação do Asaas

// 1. Criar cliente no Asaas
async function handleCreateCustomer(req, res, db, userId) {
  try {
    const { name, email, cpfCnpj, mobilePhone, address } = req.body;
    
    // Validar dados necessários
    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({
        success: false,
        error: 'Dados incompletos. Nome, email e CPF/CNPJ são obrigatórios.'
      });
    }
    
    // Criar cliente no Asaas
    const asaasResponse = await asaasClient.post('/customers', {
      name,
      email,
      cpfCnpj,
      mobilePhone,
      address
    });
    
    // Salvar referência no banco de dados
    await db.collection('customers').updateOne(
      { user_id: userId },
      { 
        $set: {
          asaas_id: asaasResponse.data.id,
          name,
          email,
          cpfCnpj,
          mobilePhone,
          updated_at: new Date()
        },
        $setOnInsert: {
          user_id: userId,
          created_at: new Date()
        }
      },
      { upsert: true }
    );
    
    return res.status(200).json({
      success: true,
      customer: asaasResponse.data
    });
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors || 'Erro ao criar cliente'
    });
  }
}

// 2. Buscar cliente no Asaas
async function handleFindCustomer(req, res, db, userId) {
  try {
    // Buscar referência do cliente no banco de dados
    const customerDb = await db.collection('customers').findOne({ user_id: userId });
    
    if (!customerDb || !customerDb.asaas_id) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
    
    // Buscar cliente no Asaas
    const asaasResponse = await asaasClient.get(`/customers/${customerDb.asaas_id}`);
    
    return res.status(200).json({
      success: true,
      customer: asaasResponse.data
    });
  } catch (error) {
    console.error('Erro ao buscar cliente no Asaas:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors || 'Erro ao buscar cliente'
    });
  }
}

// 3. Criar assinatura
async function handleCreateSubscription(req, res, db, userId) {
  try {
    const { 
      billingType, 
      nextDueDate, 
      value, 
      cycle,
      description,
      creditCard,
      creditCardHolderInfo,
      planId
    } = req.body;
    
    // Validar dados necessários
    if (!billingType || !nextDueDate || !value || !cycle) {
      return res.status(400).json({
        success: false,
        error: 'Dados incompletos para criar assinatura'
      });
    }
    
    // Buscar o customer_id do usuário
    const customerDb = await db.collection('customers').findOne({ user_id: userId });
    
    if (!customerDb || !customerDb.asaas_id) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado no Asaas. Crie o cliente primeiro.'
      });
    }
    
    // Preparar dados da assinatura
    const subscriptionData = {
      customer: customerDb.asaas_id,
      billingType,
      nextDueDate,
      value,
      cycle,
      description: description || `Assinatura ${planId || 'Premium'}`
    };
    
    // Se for pagamento com cartão de crédito
    if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
      subscriptionData.creditCard = creditCard;
      subscriptionData.creditCardHolderInfo = creditCardHolderInfo;
    }
    
    // Criar assinatura no Asaas
    const asaasResponse = await asaasClient.post('/subscriptions', subscriptionData);
    
    // Salvar assinatura no banco de dados
    await db.collection('subscriptions').insertOne({
      user_id: userId,
      subscription_id: asaasResponse.data.id,
      plan_id: planId || 'premium',
      status: 'active',
      start_date: new Date(),
      asaas_data: asaasResponse.data,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    // Criar notificação para o usuário
    await db.collection('notifications').insertOne({
      user_id: userId,
      title: 'Assinatura criada com sucesso',
      message: `Sua assinatura do plano ${planId || 'Premium'} foi criada com sucesso.`,
      type: 'success',
      notification_type: 'subscription',
      read: false,
      created_at: new Date()
    });
    
    return res.status(200).json({
      success: true,
      subscription: asaasResponse.data
    });
  } catch (error) {
    console.error('Erro ao criar assinatura no Asaas:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors || 'Erro ao criar assinatura'
    });
  }
}

// 4. Cancelar assinatura
async function handleCancelSubscription(req, res, db, userId) {
  try {
    // Buscar assinatura ativa do usuário
    const subscription = await db.collection('subscriptions').findOne({ 
      user_id: userId,
      status: 'active'
    });
    
    if (!subscription || !subscription.subscription_id) {
      return res.status(404).json({
        success: false,
        error: 'Assinatura ativa não encontrada'
      });
    }
    
    // Cancelar assinatura no Asaas
    await asaasClient.delete(`/subscriptions/${subscription.subscription_id}`);
    
    // Atualizar status no banco de dados
    await db.collection('subscriptions').updateOne(
      { _id: subscription._id },
      {
        $set: {
          status: 'canceled',
          end_date: new Date(),
          updated_at: new Date()
        }
      }
    );
    
    // Criar notificação para o usuário
    await db.collection('notifications').insertOne({
      user_id: userId,
      title: 'Assinatura cancelada',
      message: 'Sua assinatura foi cancelada com sucesso.',
      type: 'info',
      notification_type: 'subscription',
      read: false,
      created_at: new Date()
    });
    
    return res.status(200).json({
      success: true,
      message: 'Assinatura cancelada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura no Asaas:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors || 'Erro ao cancelar assinatura'
    });
  }
}

// 5. Buscar assinatura
async function handleFindSubscription(req, res, db, userId) {
  try {
    // Buscar assinatura do usuário
    const subscription = await db.collection('subscriptions').findOne({ user_id: userId });
    
    if (!subscription || !subscription.subscription_id) {
      return res.status(404).json({
        success: false,
        error: 'Assinatura não encontrada'
      });
    }
    
    // Buscar assinatura no Asaas
    const asaasResponse = await asaasClient.get(`/subscriptions/${subscription.subscription_id}`);
    
    return res.status(200).json({
      success: true,
      subscription: {
        ...asaasResponse.data,
        plan_id: subscription.plan_id,
        internal_status: subscription.status
      }
    });
  } catch (error) {
    console.error('Erro ao buscar assinatura no Asaas:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors || 'Erro ao buscar assinatura'
    });
  }
}

// 6. Buscar pagamento
async function handleFindPayment(req, res) {
  try {
    const paymentId = req.query.id;
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'ID do pagamento é obrigatório'
      });
    }
    
    // Buscar pagamento no Asaas
    const asaasResponse = await asaasClient.get(`/payments/${paymentId}`);
    
    return res.status(200).json({
      success: true,
      payment: asaasResponse.data
    });
  } catch (error) {
    console.error('Erro ao buscar pagamento no Asaas:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors || 'Erro ao buscar pagamento'
    });
  }
}

// 7. Gerar QR Code PIX
async function handlePixQrcode(req, res) {
  try {
    const paymentId = req.query.id;
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'ID do pagamento é obrigatório'
      });
    }
    
    // Buscar QR Code PIX no Asaas
    const asaasResponse = await asaasClient.get(`/payments/${paymentId}/pixQrCode`);
    
    return res.status(200).json({
      success: true,
      pixQrCode: asaasResponse.data
    });
  } catch (error) {
    console.error('Erro ao gerar QR Code PIX:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors || 'Erro ao gerar QR Code PIX'
    });
  }
}

// 8. Webhook para eventos do Asaas
async function handleWebhook(req, res, db) {
  try {
    const event = req.body;
    
    if (!event || !event.event) {
      return res.status(400).json({ error: 'Payload inválido' });
    }
    
    console.log('Evento recebido do Asaas:', event);
    
    // Extrair informações importantes
    const eventType = event.event;
    const payment = event.payment;
    const subscription = event.subscription;
    
    // Processar com base no tipo de evento
    switch (eventType) {
      case 'PAYMENT_RECEIVED':
        if (payment && payment.subscription) {
          // Buscar assinatura relacionada
          const subscriptionDb = await db.collection('subscriptions').findOne({
            subscription_id: payment.subscription
          });
          
          if (subscriptionDb) {
            // Atualizar status do pagamento
            await db.collection('subscription_payments').updateOne(
              { payment_id: payment.id },
              {
                $set: {
                  status: payment.status,
                  updated_at: new Date()
                },
                $setOnInsert: {
                  user_id: subscriptionDb.user_id,
                  subscription_id: payment.subscription,
                  payment_id: payment.id,
                  value: payment.value,
                  payment_date: new Date(payment.paymentDate),
                  created_at: new Date()
                }
              },
              { upsert: true }
            );
            
            // Notificar usuário
            await db.collection('notifications').insertOne({
              user_id: subscriptionDb.user_id,
              title: 'Pagamento recebido',
              message: `Recebemos seu pagamento de R$ ${payment.value.toFixed(2)}. Obrigado!`,
              type: 'success',
              notification_type: 'payment',
              read: false,
              created_at: new Date()
            });
          }
        }
        break;
        
      case 'PAYMENT_OVERDUE':
        if (payment && payment.subscription) {
          // Buscar assinatura relacionada
          const subscriptionDb = await db.collection('subscriptions').findOne({
            subscription_id: payment.subscription
          });
          
          if (subscriptionDb) {
            // Notificar usuário
            await db.collection('notifications').insertOne({
              user_id: subscriptionDb.user_id,
              title: 'Pagamento atrasado',
              message: `Seu pagamento de R$ ${payment.value.toFixed(2)} está atrasado. Por favor, regularize para continuar utilizando os recursos premium.`,
              type: 'warning',
              notification_type: 'payment',
              read: false,
              created_at: new Date()
            });
          }
        }
        break;
        
      case 'SUBSCRIPTION_CANCELED':
        if (subscription) {
          // Atualizar status da assinatura
          const result = await db.collection('subscriptions').updateOne(
            { subscription_id: subscription.id },
            {
              $set: {
                status: 'canceled',
                end_date: new Date(),
                updated_at: new Date()
              }
            }
          );
          
          if (result.matchedCount > 0) {
            const subscriptionDb = await db.collection('subscriptions').findOne({
              subscription_id: subscription.id
            });
            
            // Notificar usuário
            await db.collection('notifications').insertOne({
              user_id: subscriptionDb.user_id,
              title: 'Assinatura cancelada',
              message: 'Sua assinatura foi cancelada. Os recursos premium não estarão mais disponíveis.',
              type: 'info',
              notification_type: 'subscription',
              read: false,
              created_at: new Date()
            });
          }
        }
        break;
        
      // Outros eventos podem ser processados aqui
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao processar webhook do Asaas:', error);
    return res.status(500).json({ error: 'Erro ao processar webhook' });
  }
} 