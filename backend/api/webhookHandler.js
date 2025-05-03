const { MongoClient } = require('mongodb');

// URL de conexão do MongoDB
const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

/**
 * Manipulador para eventos de webhook do Asaas
 * Esta função é chamada diretamente na configuração do Express
 */
async function asaasWebhookHandler(req, res) {
  console.log('[WEBHOOK] Requisição recebida:', {
    path: req.path,
    method: req.method,
    headers: req.headers,
    body: req.body
  });
  
  try {
    // Verificar se o corpo da requisição é válido
    if (!req.body || !req.body.event || !req.body.subscription) {
      console.error('[WEBHOOK] Webhook inválido: corpo da requisição incompleto');
      return res.status(400).json({ success: false, message: 'Webhook inválido: corpo da requisição incompleto' });
    }

    // Extrair dados do webhook
    const { event, subscription } = req.body;
    
    // Verificar se o evento está relacionado a assinaturas
    const validEvents = ['SUBSCRIPTION_CREATED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_UPDATED', 
                         'SUBSCRIPTION_PAID', 'SUBSCRIPTION_CANCELED', 'SUBSCRIPTION_OVERDUE', 'SUBSCRIPTION_DELETED'];
    
    if (!validEvents.includes(event)) {
      console.log(`[WEBHOOK] Evento ignorado: ${event} - não relacionado a assinaturas`);
      return res.status(200).json({ success: true, message: 'Evento ignorado: não relacionado a assinaturas' });
    }

    // Extrair informações relevantes da assinatura
    const { id: subscriptionId, customer: customerId, status, value, cycle, nextDueDate } = subscription;
    
    console.log(`[WEBHOOK] Processando evento ${event} para assinatura ${subscriptionId} (cliente ${customerId})`);

    // Conectar ao MongoDB
    console.log(`[WEBHOOK] Conectando ao MongoDB: ${url}`);
    const client = new MongoClient(url, { useUnifiedTopology: true });
    await client.connect();
    console.log('[WEBHOOK] Conectado ao MongoDB');
    
    const db = client.db(dbName);
    
    // Atualizar na coleção de subscriptions
    const subscriptionResult = await db.collection('subscriptions').updateOne(
      { customerId: customerId },
      { 
        $set: {
          subscriptionId: subscriptionId,
          customerId: customerId,
          status: status.toLowerCase(), // Convertendo para minúsculo para manter consistência
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log(`[WEBHOOK] Atualização na coleção subscriptions: ${JSON.stringify(subscriptionResult)}`);
    
    // Atualizar na coleção de userSubscriptions
    const userSubscriptionResult = await db.collection('userSubscriptions').updateOne(
      { customerId: customerId },
      {
        $set: {
          customerId: customerId,
          subscriptionId: subscriptionId,
          status: status.toLowerCase(),
          value: value,
          cycle: cycle,
          nextDueDate: nextDueDate,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log(`[WEBHOOK] Atualização na coleção userSubscriptions: ${JSON.stringify(userSubscriptionResult)}`);
    
    // Fechar conexão
    await client.close();
    console.log('[WEBHOOK] Conexão com MongoDB fechada');
    
    return res.status(200).json({ 
      success: true, 
      message: `Webhook processado com sucesso: ${event}`,
      subscriptionId: subscriptionId,
      customerId: customerId,
      status: status
    });
    
  } catch (error) {
    console.error('[WEBHOOK] Erro ao processar webhook:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao processar webhook', 
      error: error.message 
    });
  }
}

module.exports = asaasWebhookHandler; 