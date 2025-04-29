/**
 * Handler consolidado para operações de webhook
 * Isso permite reduzir o número de funções serverless para atender às limitações do plano gratuito da Vercel
 */

const mongoose = require('mongoose');
const axios = require('axios');

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_ENABLED = process.env.MONGODB_ENABLED === 'true';
const DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Configuração Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_ACCESS_TOKEN = process.env.ASAAS_ACCESS_TOKEN;

// Esquemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  username: String,
  asaasCustomerId: String,
  planId: String,
  apiKey: String,
  subscriptionStatus: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  asaasCustomerId: String,
  asaasSubscriptionId: String,
  planId: String,
  status: String,
  nextPaymentDate: Date,
  value: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const webhookSchema = new mongoose.Schema({
  event: { type: String, required: true },
  data: Object,
  processed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Inicializar MongoDB se estiver habilitado
let dbConnection = null;
let User = null;
let Subscription = null;
let Webhook = null;

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
    Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
    Webhook = mongoose.models.Webhook || mongoose.model('Webhook', webhookSchema);
    
    return dbConnection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return null;
  }
}

// Operações disponíveis
const operations = {
  'manager': webhookManager,
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
  const operation = req.query.operation || 'manager';
  
  if (!operations[operation]) {
    return res.status(400).json({ 
      success: false, 
      message: 'Operação inválida' 
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

// Gerenciador de Webhook
async function webhookManager(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Método não permitido' 
    });
  }

  try {
    const webhookData = req.body;
    console.log('Received webhook:', JSON.stringify(webhookData, null, 2));

    if (!webhookData || !webhookData.event) {
      return res.status(400).json({ 
        success: false, 
        message: 'Dados de webhook inválidos' 
      });
    }

    // Salvar o webhook recebido
    if (MONGODB_ENABLED) {
      const webhook = new Webhook({
        event: webhookData.event,
        data: webhookData,
        processed: false
      });
      await webhook.save();
    }

    // Processar com base no tipo de evento
    switch (webhookData.event) {
      case 'PAYMENT_CONFIRMED':
        await processPaymentConfirmed(webhookData);
        break;
      case 'PAYMENT_RECEIVED':
        await processPaymentReceived(webhookData);
        break;
      case 'PAYMENT_OVERDUE':
        await processPaymentOverdue(webhookData);
        break;
      case 'SUBSCRIPTION_CANCELED':
        await processSubscriptionCanceled(webhookData);
        break;
      default:
        console.log(`Evento não processado: ${webhookData.event}`);
    }

    // Marcar webhook como processado
    if (MONGODB_ENABLED) {
      await Webhook.findOneAndUpdate(
        { 'data.id': webhookData.id },
        { processed: true }
      );
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Webhook processado com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao processar webhook', 
      error: process.env.NODE_ENV === 'production' ? undefined : error.message 
    });
  }
}

// Processar pagamento confirmado
async function processPaymentConfirmed(webhookData) {
  try {
    if (!MONGODB_ENABLED) return;

    const payment = webhookData.payment || {};
    
    if (!payment.subscription) {
      console.log('Pagamento não associado a uma assinatura');
      return;
    }

    // Buscar a assinatura no Asaas
    const subscriptionId = payment.subscription;
    const subscriptionResponse = await axios.get(
      `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
      { headers: { access_token: ASAAS_API_KEY } }
    );

    if (!subscriptionResponse.data) {
      console.log(`Assinatura não encontrada: ${subscriptionId}`);
      return;
    }

    const asaasSubscription = subscriptionResponse.data;
    const asaasCustomerId = asaasSubscription.customer;

    // Buscar o usuário pelo ID do cliente no Asaas
    const user = await User.findOne({ asaasCustomerId });
    
    if (!user) {
      console.log(`Usuário não encontrado para o cliente Asaas: ${asaasCustomerId}`);
      return;
    }

    // Atualizar a assinatura no banco de dados
    const subscription = await Subscription.findOne({ asaasSubscriptionId: subscriptionId });
    
    if (subscription) {
      subscription.status = asaasSubscription.status;
      subscription.nextPaymentDate = asaasSubscription.nextDueDate;
      subscription.updatedAt = new Date();
      await subscription.save();
    } else {
      // Criar nova assinatura se não existir
      await Subscription.create({
        userId: user._id,
        asaasCustomerId,
        asaasSubscriptionId: subscriptionId,
        planId: user.planId,
        status: asaasSubscription.status,
        nextPaymentDate: asaasSubscription.nextDueDate,
        value: asaasSubscription.value
      });
    }

    // Atualizar o status da assinatura do usuário
    user.subscriptionStatus = asaasSubscription.status;
    user.updatedAt = new Date();
    await user.save();

    console.log(`Processado pagamento confirmado para o usuário ${user.email}`);
  } catch (error) {
    console.error('Erro ao processar pagamento confirmado:', error);
  }
}

// Processar pagamento recebido
async function processPaymentReceived(webhookData) {
  // Similar ao pagamento confirmado
  await processPaymentConfirmed(webhookData);
}

// Processar pagamento atrasado
async function processPaymentOverdue(webhookData) {
  try {
    if (!MONGODB_ENABLED) return;

    const payment = webhookData.payment || {};
    
    if (!payment.subscription) {
      console.log('Pagamento não associado a uma assinatura');
      return;
    }

    // Buscar a assinatura no Asaas
    const subscriptionId = payment.subscription;
    const subscriptionResponse = await axios.get(
      `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
      { headers: { access_token: ASAAS_API_KEY } }
    );

    if (!subscriptionResponse.data) {
      console.log(`Assinatura não encontrada: ${subscriptionId}`);
      return;
    }

    const asaasSubscription = subscriptionResponse.data;
    const asaasCustomerId = asaasSubscription.customer;

    // Buscar o usuário pelo ID do cliente no Asaas
    const user = await User.findOne({ asaasCustomerId });
    
    if (!user) {
      console.log(`Usuário não encontrado para o cliente Asaas: ${asaasCustomerId}`);
      return;
    }

    // Atualizar a assinatura no banco de dados
    const subscription = await Subscription.findOne({ asaasSubscriptionId: subscriptionId });
    
    if (subscription) {
      subscription.status = 'OVERDUE';
      subscription.updatedAt = new Date();
      await subscription.save();
    }

    // Atualizar o status da assinatura do usuário
    user.subscriptionStatus = 'OVERDUE';
    user.updatedAt = new Date();
    await user.save();

    console.log(`Processado pagamento atrasado para o usuário ${user.email}`);
  } catch (error) {
    console.error('Erro ao processar pagamento atrasado:', error);
  }
}

// Processar cancelamento de assinatura
async function processSubscriptionCanceled(webhookData) {
  try {
    if (!MONGODB_ENABLED) return;

    const subscriptionId = webhookData.subscription?.id;
    
    if (!subscriptionId) {
      console.log('ID da assinatura não fornecido');
      return;
    }

    // Buscar a assinatura no banco de dados
    const subscription = await Subscription.findOne({ asaasSubscriptionId: subscriptionId });
    
    if (!subscription) {
      console.log(`Assinatura não encontrada: ${subscriptionId}`);
      return;
    }

    // Atualizar o status da assinatura
    subscription.status = 'CANCELED';
    subscription.updatedAt = new Date();
    await subscription.save();

    // Buscar e atualizar o usuário
    const user = await User.findById(subscription.userId);
    
    if (user) {
      user.subscriptionStatus = 'CANCELED';
      user.updatedAt = new Date();
      await user.save();
      console.log(`Processado cancelamento de assinatura para o usuário ${user.email}`);
    } else {
      console.log(`Usuário não encontrado para a assinatura ${subscriptionId}`);
    }
  } catch (error) {
    console.error('Erro ao processar cancelamento de assinatura:', error);
  }
} 