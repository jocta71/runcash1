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

  // Apenas aceitar solicitações POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client;

  try {
    console.log('Webhook do Asaas recebido:', JSON.stringify(req.body));
    
    const event = req.body;
    
    // Verificar se o webhook contém os dados necessários
    if (!event || !event.event) {
      console.error('Webhook inválido:', event);
      return res.status(400).json({ error: 'Webhook inválido' });
    }

    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    // Processamento baseado no tipo de evento
    switch (event.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        await handlePaymentConfirmed(db, event);
        break;
      
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(db, event);
        break;
      
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_CONFIRMED':
        await handlePaymentRefunded(db, event);
        break;
      
      case 'SUBSCRIPTION_CANCELLED':
        await handleSubscriptionCancelled(db, event);
        break;
    
      default:
        console.log(`Evento não processado: ${event.event}`);
    }

    // Responder com sucesso
    return res.status(200).json({ success: true, message: 'Webhook processado' });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({ error: 'Erro ao processar webhook' });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
};

// Função para lidar com pagamentos confirmados
async function handlePaymentConfirmed(db, event) {
  try {
    const paymentId = event.payment.id;
    const subscriptionId = event.payment.subscription;
    
    console.log(`Processando pagamento confirmado: ${paymentId} para assinatura ${subscriptionId}`);
    
    if (subscriptionId) {
      // Atualizar status da assinatura no MongoDB
      const result = await db.collection('subscriptions').updateOne(
        { payment_id: subscriptionId },
        { 
          $set: { 
            status: 'active',
            last_payment_date: new Date(),
            last_payment_id: paymentId,
            updated_at: new Date()
          }
        }
      );
      
      console.log(`Assinatura atualizada: ${result.modifiedCount} documento(s)`);
      
      // Registrar o pagamento no histórico
      await db.collection('payment_history').insertOne({
        subscription_id: subscriptionId,
        payment_id: paymentId,
        event: 'payment_confirmed',
        amount: event.payment.value,
        date: new Date(),
        data: JSON.stringify(event)
      });
    }
  } catch (error) {
    console.error('Erro ao processar pagamento confirmado:', error);
    throw error;
  }
}

// Função para lidar com pagamentos em atraso
async function handlePaymentOverdue(db, event) {
  try {
    const paymentId = event.payment.id;
    const subscriptionId = event.payment.subscription;
    
    console.log(`Processando pagamento em atraso: ${paymentId} para assinatura ${subscriptionId}`);
    
    if (subscriptionId) {
      // Atualizar status da assinatura no MongoDB
      const result = await db.collection('subscriptions').updateOne(
        { payment_id: subscriptionId },
        { 
          $set: { 
            status: 'overdue',
            updated_at: new Date()
          }
        }
      );
      
      console.log(`Assinatura marcada como atrasada: ${result.modifiedCount} documento(s)`);
      
      // Registrar o evento no histórico
      await db.collection('payment_history').insertOne({
        subscription_id: subscriptionId,
        payment_id: paymentId,
        event: 'payment_overdue',
        amount: event.payment.value,
        date: new Date(),
        data: JSON.stringify(event)
      });
    }
  } catch (error) {
    console.error('Erro ao processar pagamento em atraso:', error);
    throw error;
  }
}

// Função para lidar com pagamentos reembolsados
async function handlePaymentRefunded(db, event) {
  try {
    const paymentId = event.payment.id;
    const subscriptionId = event.payment.subscription;
    
    console.log(`Processando reembolso: ${paymentId} para assinatura ${subscriptionId}`);
    
    if (subscriptionId) {
      // Atualizar status da assinatura no MongoDB
      const result = await db.collection('subscriptions').updateOne(
        { payment_id: subscriptionId },
        { 
          $set: { 
            status: 'refunded',
            updated_at: new Date()
          }
        }
      );
      
      console.log(`Assinatura marcada como reembolsada: ${result.modifiedCount} documento(s)`);
      
      // Registrar o evento no histórico
      await db.collection('payment_history').insertOne({
        subscription_id: subscriptionId,
        payment_id: paymentId,
        event: 'payment_refunded',
        amount: event.payment.value,
        date: new Date(),
        data: JSON.stringify(event)
      });
    }
  } catch (error) {
    console.error('Erro ao processar reembolso:', error);
    throw error;
  }
}

// Função para lidar com assinaturas canceladas
async function handleSubscriptionCancelled(db, event) {
  try {
    const subscriptionId = event.subscription.id;
    
    console.log(`Processando cancelamento de assinatura: ${subscriptionId}`);
    
    // Atualizar status da assinatura no MongoDB
    const result = await db.collection('subscriptions').updateOne(
      { payment_id: subscriptionId },
      { 
        $set: { 
          status: 'cancelled',
          cancelled_at: new Date(),
          updated_at: new Date()
        }
      }
    );
    
    console.log(`Assinatura marcada como cancelada: ${result.modifiedCount} documento(s)`);
    
    // Registrar o evento no histórico
    await db.collection('payment_history').insertOne({
      subscription_id: subscriptionId,
      event: 'subscription_cancelled',
      date: new Date(),
      data: JSON.stringify(event)
    });
  } catch (error) {
    console.error('Erro ao processar cancelamento de assinatura:', error);
    throw error;
  }
} 