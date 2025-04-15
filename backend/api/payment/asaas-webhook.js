const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

// Configurações da API Asaas
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

console.log(`[WEBHOOK] Usando Asaas em ambiente: ${ASAAS_ENVIRONMENT}`);

// URI de conexão com o MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

// Inicializar cliente MongoDB
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  
  // Conectar ao MongoDB
  const client = await MongoClient.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  const db = client.db();
  cachedDb = db;
  return db;
}

module.exports = async (req, res) => {
  // Configurar CORS para aceitar qualquer origem
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Responder a requisições preflight OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Para requisições GET (verificação do webhook)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Webhook endpoint ativo. Use POST para eventos do Asaas.',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', method: req.method });
  }

  // Debug dos headers e corpo recebidos
  console.log('Headers recebidos:', req.headers);
  console.log('Corpo da requisição:', req.body);

  try {
    const webhookData = req.body;
    console.log('Evento recebido do Asaas:', webhookData);
    
    // Conectar ao MongoDB
    console.log('Conectando ao MongoDB...');
    const db = await connectToDatabase();
    console.log('Conexão com MongoDB estabelecida');
    
    // Registrar o webhook para histórico
    try {
      await db.collection('webhook_logs').insertOne({
        provider: 'asaas',
        event_type: webhookData.event,
        payload: webhookData,
        created_at: new Date()
      });
      console.log('Webhook registrado no log');
    } catch (logError) {
      console.error('Erro ao registrar webhook:', logError);
      // Continuar mesmo com erro de log
    }
    
    // Processar diferentes tipos de eventos
    const eventType = webhookData.event;
    const payment = webhookData.payment;
    
    if (!payment) {
      return res.status(400).json({ error: 'Dados de pagamento não fornecidos' });
    }
    
    // Obter ID da assinatura do pagamento
    const subscriptionId = payment.subscription;
    
    if (!subscriptionId) {
      console.log('Pagamento não relacionado a uma assinatura', payment);
      return res.status(200).json({ message: 'Evento ignorado - não é uma assinatura' });
    }
    
    // Buscar informações atualizadas da assinatura
    try {
      const apiKey = process.env.ASAAS_API_KEY;
      
      if (!apiKey) {
        console.error('API key do Asaas não configurada');
        throw new Error('A chave de API do Asaas não está configurada no servidor');
      }
      
      const subscriptionResponse = await axios({
        method: 'get',
        url: `${API_BASE_URL}/subscriptions/${subscriptionId}`,
        headers: {
          'access_token': apiKey
        }
      });
      
      const subscriptionDetails = subscriptionResponse.data;
      console.log('Detalhes da assinatura:', subscriptionDetails);
      
      // Buscar assinatura no MongoDB pelo payment_id
      const subscriptionData = await db.collection('subscriptions').findOne({ payment_id: subscriptionId });
      
      if (!subscriptionData) {
        console.error('Assinatura não encontrada no banco de dados:', subscriptionId);
        return res.status(404).json({ error: 'Assinatura não encontrada', subscription_id: subscriptionId });
      }
      
      // Processar eventos
      let updateData = {};
      
      switch (eventType) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_RECEIVED': {
          // Atualizar assinatura para ativa quando o pagamento é confirmado
          updateData = { 
            status: 'active',
            updated_at: new Date() 
          };
          
          console.log(`Atualizando assinatura ${subscriptionData._id} para status: active`);
          break;
        }
        
        case 'PAYMENT_OVERDUE': {
          // Atualizar assinatura para atrasada
          updateData = { 
            status: 'overdue',
            updated_at: new Date() 
          };
          
          console.log(`Atualizando assinatura ${subscriptionData._id} para status: overdue`);
          break;
        }
        
        case 'PAYMENT_DELETED':
        case 'PAYMENT_REFUNDED':
        case 'PAYMENT_REFUND_REQUESTED':
        case 'SUBSCRIPTION_CANCELLED': {
          // Cancelar assinatura
          updateData = { 
            status: 'canceled',
            end_date: new Date(),
            updated_at: new Date() 
          };
          
          console.log(`Atualizando assinatura ${subscriptionData._id} para status: canceled`);
          break;
        }
        
        default:
          console.log(`Evento não processado: ${eventType}`);
          return res.status(200).json({ 
            success: true, 
            message: `Evento ${eventType} não requer atualização de status` 
          });
      }
      
      // Atualizar no banco de dados
      const result = await db.collection('subscriptions').updateOne(
        { _id: subscriptionData._id }, 
        { $set: updateData }
      );
      
      if (result.modifiedCount === 0) {
        console.error('Assinatura não foi atualizada:', subscriptionData._id);
      } else {
        console.log('Assinatura atualizada com sucesso');
      }
      
      // Criar notificação para o usuário
      try {
        await db.collection('notifications').insertOne({
          user_id: subscriptionData.user_id,
          title: getNotificationTitle(eventType),
          message: getNotificationMessage(eventType),
          type: getNotificationType(eventType),
          read: false,
          created_at: new Date()
        });
        console.log('Notificação criada para o usuário:', subscriptionData.user_id);
      } catch (notifyError) {
        console.error('Erro ao criar notificação:', notifyError);
      }
      
      return res.status(200).json({ 
        success: true, 
        message: `Evento ${eventType} processado com sucesso` 
      });
    } catch (apiError) {
      console.error('Erro ao buscar detalhes da assinatura na API Asaas:', apiError.message);
      return res.status(500).json({
        error: 'Erro ao processar webhook',
        details: apiError.message
      });
    }
  } catch (error) {
    console.error('Erro ao processar webhook do Asaas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
};

// Funções auxiliares para notificações
function getNotificationTitle(eventType) {
  switch (eventType) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      return 'Pagamento confirmado';
    case 'PAYMENT_OVERDUE':
      return 'Pagamento atrasado';
    case 'PAYMENT_DELETED':
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_REFUND_REQUESTED':
      return 'Pagamento cancelado';
    case 'SUBSCRIPTION_CANCELLED':
      return 'Assinatura cancelada';
    default:
      return 'Atualização de assinatura';
  }
}

function getNotificationMessage(eventType) {
  switch (eventType) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      return 'Seu pagamento foi confirmado. Sua assinatura está ativa.';
    case 'PAYMENT_OVERDUE':
      return 'Seu pagamento está atrasado. Por favor, regularize para manter seu acesso.';
    case 'PAYMENT_DELETED':
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_REFUND_REQUESTED':
      return 'Seu pagamento foi cancelado ou estornado.';
    case 'SUBSCRIPTION_CANCELLED':
      return 'Sua assinatura foi cancelada.';
    default:
      return 'Houve uma atualização no status da sua assinatura.';
  }
}

function getNotificationType(eventType) {
  switch (eventType) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      return 'success';
    case 'PAYMENT_OVERDUE':
      return 'warning';
    case 'PAYMENT_DELETED':
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_REFUND_REQUESTED':
    case 'SUBSCRIPTION_CANCELLED':
      return 'error';
    default:
      return 'info';
  }
} 