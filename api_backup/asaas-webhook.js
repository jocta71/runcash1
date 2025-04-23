// Endpoint para receber notificações de webhook do Asaas
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
    const webhookData = req.body;
    console.log('Webhook recebido do Asaas:', JSON.stringify(webhookData));

    // Validar dados do webhook
    if (!webhookData || !webhookData.event) {
      return res.status(400).json({
        success: false,
        error: 'Dados de webhook inválidos'
      });
    }

    // Processar apenas se o MongoDB estiver habilitado
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        // Registrar evento no MongoDB
        await db.collection('asaas_events').insertOne({
          event_type: webhookData.event,
          payment_id: webhookData.payment?.id,
          subscription_id: webhookData.payment?.subscription,
          customer_id: webhookData.payment?.customer,
          status: webhookData.payment?.status,
          value: webhookData.payment?.value,
          raw_data: webhookData,
          created_at: new Date()
        });
        
        console.log('Evento Asaas registrado no MongoDB');
        
        // Atualizar status da assinatura, se aplicável
        if (webhookData.payment?.subscription) {
          const subscriptionId = webhookData.payment.subscription;
          
          await db.collection('subscriptions').updateOne(
            { subscription_id: subscriptionId },
            { 
              $set: { 
                status: webhookData.payment.status,
                updated_at: new Date()
              }
            }
          );
          
          console.log(`Status da assinatura ${subscriptionId} atualizado para ${webhookData.payment.status}`);
        }
        
        // Atualizar status de pagamento, se aplicável
        if (webhookData.payment?.id) {
          const paymentId = webhookData.payment.id;
          
          await db.collection('payments').updateOne(
            { payment_id: paymentId },
            { 
              $set: { 
                status: webhookData.payment.status,
                updated_at: new Date()
              }
            },
            { upsert: true }
          );
          
          console.log(`Status do pagamento ${paymentId} atualizado para ${webhookData.payment.status}`);
        }
      } catch (dbError) {
        console.error('Erro ao processar webhook no MongoDB:', dbError.message);
      }
    }

    // Responder com sucesso
    return res.status(200).json({
      success: true,
      message: 'Webhook processado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar webhook:', error.message);
    
    return res.status(500).json({
      success: false,
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