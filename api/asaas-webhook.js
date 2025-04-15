const { MongoClient } = require('mongodb');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Asaas-Access-Token');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client;
  
  try {
    // Verificar se a requisição está vindo realmente do Asaas
    const asaasSignature = req.headers['x-asaas-access-token'];
    
    if (!asaasSignature) {
      console.warn('Requisição sem assinatura do Asaas');
      // Em produção, descomentar a linha abaixo para exigir assinatura
      // return res.status(401).json({ error: 'Assinatura Asaas ausente' });
    }
    
    // Em produção, validar a assinatura do Asaas
    const WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET;
    
    if (WEBHOOK_SECRET && asaasSignature) {
      // Validando assinatura - apenas para ambiente de produção
      const requestBody = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(requestBody)
        .digest('hex');
        
      if (asaasSignature !== expectedSignature) {
        console.warn('Assinatura do webhook inválida');
        return res.status(401).json({ error: 'Assinatura inválida' });
      }
    }

    const event = req.body;
    console.log('Webhook recebido do Asaas:', JSON.stringify(event));

    // Verificar se os dados do evento são válidos
    if (!event || !event.event || !event.payment) {
      console.error('Formato inválido de webhook');
      return res.status(400).json({ error: 'Formato inválido de webhook' });
    }

    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');

    // Dados do pagamento/assinatura
    const paymentId = event.payment.id;
    const subscriptionId = event.payment.subscription;
    const eventType = event.event;
    const status = event.payment.status;
    
    console.log(`Processando evento: ${eventType} para pagamento: ${paymentId}, status: ${status}, assinatura: ${subscriptionId || 'N/A'}`);

    // Registrar o evento na tabela de logs
    await db.collection('webhook_logs').insertOne({
      provider: 'asaas',
      event_type: eventType,
      event_data: event,
      payment_id: paymentId,
      subscription_id: subscriptionId,
      received_at: new Date(),
      processed: false
    });

    // Se não for uma assinatura, simplesmente registramos o evento
    if (!subscriptionId) {
      console.log('Evento não relacionado a assinatura. Apenas registrado.');
      return res.status(200).json({ message: 'Evento registrado com sucesso' });
    }

    // Processar evento com base no tipo
    switch (eventType) {
      case 'PAYMENT_CREATED':
      case 'PAYMENT_UPDATED':
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_OVERDUE':
      case 'PAYMENT_DELETED':
      case 'PAYMENT_RESTORED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_CANCELED':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
      case 'PAYMENT_CHARGEBACK_DISPUTE':
      case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
      case 'PAYMENT_DUNNING_RECEIVED':
      case 'PAYMENT_DUNNING_REQUESTED':
        // Atualizar status da assinatura no banco de dados
        await processPaymentEvent(db, event, subscriptionId);
        break;
      
      case 'SUBSCRIPTION_CREATED':
      case 'SUBSCRIPTION_UPDATED':
      case 'SUBSCRIPTION_CANCELED':
      case 'SUBSCRIPTION_ENDED':
      case 'SUBSCRIPTION_EXPIRED':
      case 'SUBSCRIPTION_ACTIVATED':
      case 'SUBSCRIPTION_RENEWED':
        // Atualizar status da assinatura no banco de dados
        await processSubscriptionEvent(db, event, subscriptionId);
        break;
      
      default:
        console.log(`Tipo de evento não processado: ${eventType}`);
    }

    // Marcar o evento como processado
    await db.collection('webhook_logs').updateOne(
      { 'event_data.payment.id': paymentId },
      { $set: { processed: true, processed_at: new Date() } }
    );

    return res.status(200).json({ 
      message: 'Webhook processado com sucesso',
      event: eventType,
      status: 'success'
    });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({ 
      error: 'Erro ao processar webhook',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
};

// Processa eventos relacionados a pagamentos
async function processPaymentEvent(db, event, subscriptionId) {
  const paymentStatus = event.payment.status;
  let subscriptionStatus;

  // Mapear status do pagamento para status da assinatura
  switch (paymentStatus) {
    case 'CONFIRMED':
    case 'RECEIVED':
      subscriptionStatus = 'active';
      break;
    case 'OVERDUE':
      subscriptionStatus = 'overdue';
      break;
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'REFUND_IN_PROGRESS':
      subscriptionStatus = 'refunded';
      break;
    case 'PENDING':
    case 'AWAITING_RISK_ANALYSIS':
      subscriptionStatus = 'pending';
      break;
    default:
      subscriptionStatus = 'pending';
  }

  try {
    // Buscar assinatura pelo ID de referência do Asaas
    const subscription = await db.collection('subscriptions').findOne({
      payment_id: subscriptionId
    });

    if (!subscription) {
      console.error(`Assinatura não encontrada para o ID: ${subscriptionId}`);
      return;
    }

    // Atualizar status da assinatura
    await db.collection('subscriptions').updateOne(
      { payment_id: subscriptionId },
      { 
        $set: { 
          status: subscriptionStatus,
          updated_at: new Date(),
          payment_status: paymentStatus,
          payment_last_event: event.event,
          payment_last_update: new Date()
        } 
      }
    );

    console.log(`Assinatura ${subscriptionId} atualizada para ${subscriptionStatus}.`);

    // Para pagamentos confirmados, atualizar a data de validade da assinatura
    if (paymentStatus === 'CONFIRMED' || paymentStatus === 'RECEIVED') {
      // Obter período do plano (obtido da primeira assinatura)
      const interval = (subscription.plan_id === 'monthly') ? 30 : 365;
      
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + interval);
      
      await db.collection('subscriptions').updateOne(
        { payment_id: subscriptionId },
        { 
          $set: { 
            valid_until: expiryDate
          } 
        }
      );
      
      console.log(`Validade da assinatura ${subscriptionId} definida até ${expiryDate.toISOString()}`);
    }
  } catch (error) {
    console.error(`Erro ao processar evento de pagamento: ${error.message}`);
    throw error;
  }
}

// Processa eventos relacionados a assinaturas
async function processSubscriptionEvent(db, event, subscriptionId) {
  const subscriptionStatus = event.subscription.status;
  let dbSubscriptionStatus;

  // Mapear status da assinatura do Asaas para nosso status interno
  switch (subscriptionStatus) {
    case 'ACTIVE':
      dbSubscriptionStatus = 'active';
      break;
    case 'EXPIRED':
      dbSubscriptionStatus = 'expired';
      break;
    case 'OVERDUE':
      dbSubscriptionStatus = 'overdue';
      break;
    case 'CANCELED':
      dbSubscriptionStatus = 'cancelled';
      break;
    case 'ENDED':
      dbSubscriptionStatus = 'ended';
      break;
    default:
      dbSubscriptionStatus = 'pending';
  }

  try {
    // Atualizar status da assinatura no banco de dados
    await db.collection('subscriptions').updateOne(
      { payment_id: subscriptionId },
      { 
        $set: { 
          status: dbSubscriptionStatus,
          updated_at: new Date(),
          subscription_status: subscriptionStatus,
          subscription_last_event: event.event,
          subscription_last_update: new Date()
        } 
      }
    );

    console.log(`Status da assinatura ${subscriptionId} atualizado para ${dbSubscriptionStatus}`);
  } catch (error) {
    console.error(`Erro ao processar evento de assinatura: ${error.message}`);
    throw error;
  }
} 