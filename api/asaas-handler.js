/**
 * Handler consolidado para todas as operações relacionadas ao Asaas
 * Isso permite reduzir o número de funções serverless para atender às limitações do plano gratuito da Vercel
 */

const axios = require('axios');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Configuração Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const ASAAS_API_URL = ASAAS_ENVIRONMENT === 'sandbox'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://www.asaas.com/api/v3';

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_ENABLED = process.env.MONGODB_ENABLED === 'true';
const DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Esquema do Usuário
const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  username: String,
  asaasCustomerId: String,
});

// Esquema de AssinaturaAsaas
const asaasSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  asaasSubscriptionId: String,
  asaasCustomerId: String,
  status: String,
  nextDueDate: Date,
  value: Number,
  paymentLink: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Inicializar MongoDB se estiver habilitado
let dbConnection = null;
let User = null;
let AsaasSubscription = null;

async function connectToDatabase() {
  if (!MONGODB_ENABLED) return null;
  
  try {
    if (dbConnection) return dbConnection;
    
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    dbConnection = mongoose.connection;
    console.log('Connected to MongoDB');
    
    // Definir modelos
    User = mongoose.models.User || mongoose.model('User', userSchema);
    AsaasSubscription = mongoose.models.AsaasSubscription || 
      mongoose.model('AsaasSubscription', asaasSubscriptionSchema);
    
    return dbConnection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return null;
  }
}

// Cliente Asaas API
const asaasClient = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'access_token': ASAAS_API_KEY,
    'Content-Type': 'application/json'
  }
});

// Operações disponíveis
const operations = {
  'create-customer': createCustomer,
  'find-customer': findCustomer,
  'create-subscription': createSubscription,
  'find-subscription': findSubscription,
  'cancel-subscription': cancelSubscription,
  'find-payment': findPayment,
  'pix-qrcode': getPixQRCode,
};

// Handler principal
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Lidar com preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Obter a operação da query string
  const operation = req.query.operation;
  
  if (!operation || !operations[operation]) {
    return res.status(400).json({ 
      success: false, 
      message: 'Operação inválida ou não especificada' 
    });
  }

  try {
    // Conectar ao banco de dados se necessário
    if (MONGODB_ENABLED) {
      await connectToDatabase();
    }
    
    // Executar a operação especificada
    await operations[operation](req, res);
  } catch (error) {
    console.error(`Erro ao executar operação ${operation}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// Implementação das operações
async function createCustomer(req, res) {
  try {
    const { name, email, phone, cpfCnpj, address, addressNumber, complement, province, postalCode, externalId } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Nome e email são obrigatórios' });
    }
    
    // Verificar se já existe um cliente com este email
    const existingCustomerResponse = await asaasClient.get(`/customers?email=${encodeURIComponent(email)}`);
    
    if (existingCustomerResponse.data.data && existingCustomerResponse.data.data.length > 0) {
      const customer = existingCustomerResponse.data.data[0];
      
      if (MONGODB_ENABLED && externalId) {
        // Salvar ID do cliente no usuário
        const user = await User.findById(externalId);
        if (user) {
          user.asaasCustomerId = customer.id;
          await user.save();
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Cliente já existe',
        customerId: customer.id,
        customer
      });
    }
    
    // Criar novo cliente
    const customerData = {
      name,
      email,
      phone,
      mobilePhone: phone,
      cpfCnpj,
      address,
      addressNumber,
      complement,
      province,
      postalCode,
      externalReference: externalId
    };
    
    const response = await asaasClient.post('/customers', customerData);
    const newCustomer = response.data;
    
    if (MONGODB_ENABLED && externalId) {
      // Salvar ID do cliente no usuário
      const user = await User.findById(externalId);
      if (user) {
        user.asaasCustomerId = newCustomer.id;
        await user.save();
      }
    }
    
    return res.status(201).json({
      success: true,
      message: 'Cliente criado com sucesso',
      customerId: newCustomer.id,
      customer: newCustomer
    });
  } catch (error) {
    console.error('[createCustomer] Erro:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar cliente',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

async function findCustomer(req, res) {
  try {
    const { customerId, email } = req.query;
    
    if (!customerId && !email) {
      return res.status(400).json({ success: false, message: 'ID do cliente ou email são obrigatórios' });
    }
    
    let customerResponse;
    
    if (customerId) {
      customerResponse = await asaasClient.get(`/customers/${customerId}`);
    } else {
      customerResponse = await asaasClient.get(`/customers?email=${encodeURIComponent(email)}`);
      
      if (customerResponse.data.data && customerResponse.data.data.length > 0) {
        customerResponse.data = customerResponse.data.data[0];
      } else {
        return res.status(404).json({ success: false, message: 'Cliente não encontrado' });
      }
    }
    
    return res.status(200).json({
      success: true,
      customer: customerResponse.data
    });
  } catch (error) {
    console.error('[findCustomer] Erro:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar cliente',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

async function createSubscription(req, res) {
  try {
    const { 
      customerId, 
      billingType = 'UNDEFINED', 
      value = 39.90, 
      nextDueDate, 
      cycle = 'MONTHLY',
      description = 'Assinatura RunCash Premium', 
      userId
    } = req.body;
    
    if (!customerId) {
      return res.status(400).json({ success: false, message: 'ID do cliente é obrigatório' });
    }
    
    // Definir próxima data de vencimento (amanhã se não for fornecida)
    const dueDate = nextDueDate || (() => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      return date.toISOString().split('T')[0];
    })();
    
    // Dados da assinatura
    const subscriptionData = {
      customer: customerId,
      billingType,
      value,
      nextDueDate: dueDate,
      cycle,
      description
    };
    
    // Criar assinatura na Asaas
    const response = await asaasClient.post('/subscriptions', subscriptionData);
    const subscription = response.data;
    
    // Salvar no banco de dados se estiver habilitado
    if (MONGODB_ENABLED && userId) {
      const newSubscription = new AsaasSubscription({
        userId,
        asaasSubscriptionId: subscription.id,
        asaasCustomerId: customerId,
        status: subscription.status,
        nextDueDate: subscription.nextDueDate,
        value: subscription.value
      });
      
      await newSubscription.save();
    }
    
    // Gerar link de pagamento se billingType for indefinido
    let paymentLink = null;
    if (billingType === 'UNDEFINED') {
      try {
        const linkResponse = await asaasClient.post('/paymentLinks', {
          name: 'Assinatura RunCash',
          description: description,
          endDate: null,
          value: value,
          billingType: 'UNDEFINED',
          chargeType: 'SUBSCRIPTION',
          subscriptionCycle: cycle,
          maxInstallmentCount: 1,
          dueDateLimitDays: 10
        });
        
        paymentLink = linkResponse.data.url;
        
        // Atualizar na base de dados
        if (MONGODB_ENABLED && userId) {
          await AsaasSubscription.findOneAndUpdate(
            { asaasSubscriptionId: subscription.id },
            { paymentLink }
          );
        }
      } catch (linkError) {
        console.error('Erro ao gerar link de pagamento:', linkError);
      }
    }
    
    return res.status(201).json({
      success: true,
      message: 'Assinatura criada com sucesso',
      subscription,
      paymentLink
    });
  } catch (error) {
    console.error('[createSubscription] Erro:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar assinatura',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

async function findSubscription(req, res) {
  try {
    const { subscriptionId, customerId } = req.query;
    
    if (!subscriptionId && !customerId) {
      return res.status(400).json({ success: false, message: 'ID da assinatura ou ID do cliente são obrigatórios' });
    }
    
    if (subscriptionId) {
      // Buscar uma assinatura específica
      const subscriptionResponse = await asaasClient.get(`/subscriptions/${subscriptionId}`);
      
      return res.status(200).json({
        success: true,
        subscriptions: [subscriptionResponse.data]
      });
    } else {
      // Buscar todas as assinaturas de um cliente
      const subscriptionsResponse = await asaasClient.get(`/subscriptions?customer=${customerId}`);
      
      if (!subscriptionsResponse.data.data || subscriptionsResponse.data.data.length === 0) {
        return res.status(404).json({ success: false, message: 'Nenhuma assinatura encontrada' });
      }
      
      // Buscar pagamentos relacionados à assinatura
      let payments = [];
      if (subscriptionsResponse.data.data.length > 0) {
        try {
          const latestSubscription = subscriptionsResponse.data.data[0];
          const paymentsResponse = await asaasClient.get(`/subscriptions/${latestSubscription.id}/payments`);
          payments = paymentsResponse.data.data || [];
        } catch (err) {
          console.error('Erro ao buscar pagamentos:', err);
        }
      }
      
      return res.status(200).json({
        success: true,
        subscriptions: subscriptionsResponse.data.data,
        payments
      });
    }
  } catch (error) {
    console.error('[findSubscription] Erro:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar assinatura',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

async function cancelSubscription(req, res) {
  try {
    const { subscriptionId } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ success: false, message: 'ID da assinatura é obrigatório' });
    }
    
    // Cancelar assinatura na Asaas
    await asaasClient.delete(`/subscriptions/${subscriptionId}`);
    
    // Atualizar status no banco de dados se estiver habilitado
    if (MONGODB_ENABLED) {
      await AsaasSubscription.findOneAndUpdate(
        { asaasSubscriptionId: subscriptionId },
        { status: 'CANCELLED' }
      );
    }
    
    return res.status(200).json({
      success: true,
      message: 'Assinatura cancelada com sucesso'
    });
  } catch (error) {
    console.error('[cancelSubscription] Erro:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao cancelar assinatura',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

async function findPayment(req, res) {
  try {
    const { paymentId } = req.query;
    
    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'ID do pagamento é obrigatório' });
    }
    
    const paymentResponse = await asaasClient.get(`/payments/${paymentId}`);
    
    return res.status(200).json({
      success: true,
      payment: paymentResponse.data
    });
  } catch (error) {
    console.error('[findPayment] Erro:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar pagamento',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

async function getPixQRCode(req, res) {
  try {
    const { paymentId } = req.query;
    
    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'ID do pagamento é obrigatório' });
    }
    
    const pixResponse = await asaasClient.get(`/payments/${paymentId}/pixQrCode`);
    
    return res.status(200).json({
      success: true,
      pixInfo: pixResponse.data
    });
  } catch (error) {
    console.error('[getPixQRCode] Erro:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao gerar QR Code PIX',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
} 