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
  let dbConnected = false;
  let webhookData = null;
  
  try {
    webhookData = req.body;
    console.log('Webhook recebido do Asaas:', JSON.stringify(webhookData));

    // Validar dados do webhook
    if (!webhookData || !webhookData.event) {
      return res.status(400).json({
        success: false,
        error: 'Dados de webhook inválidos'
      });
    }

    // Responder rapidamente para o Asaas, para evitar que reenvie o webhook
    // Este padrão é recomendado para webhooks - "ack rápido, processamento assíncrono"
    res.status(200).json({
      success: true,
      message: 'Webhook recebido, processamento iniciado'
    });

    // Processar apenas se o MongoDB estiver habilitado
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        dbConnected = true;
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        // Registrar evento bruto no MongoDB para garantir que não perdemos dados
        const rawEvent = await db.collection('asaas_events_raw').insertOne({
          event_type: webhookData.event,
          raw_data: webhookData,
          processed: false,
          created_at: new Date(),
          process_attempts: 0
        });
        
        console.log('Evento Asaas bruto registrado no MongoDB:', rawEvent.insertedId);
        
        // Extrair e estruturar os dados para armazenamento
        const eventData = {
          event_type: webhookData.event,
          payment_id: webhookData.payment?.id,
          subscription_id: webhookData.payment?.subscription,
          customer_id: webhookData.payment?.customer,
          status: webhookData.payment?.status,
          value: webhookData.payment?.value,
          raw_data: webhookData,
          created_at: new Date(),
          processed_at: new Date()
        };
        
        // Registrar evento processado
        await db.collection('asaas_events').insertOne(eventData);
        console.log('Evento Asaas processado e registrado no MongoDB');
        
        // Atualizar status da assinatura, se aplicável
        if (webhookData.payment?.subscription) {
          const subscriptionId = webhookData.payment.subscription;
          
          // Verificar se a assinatura existe
          const existingSubscription = await db.collection('subscriptions').findOne({
            subscription_id: subscriptionId
          });
          
          if (existingSubscription) {
            await db.collection('subscriptions').updateOne(
              { subscription_id: subscriptionId },
              { 
                $set: { 
                  status: webhookData.payment.status === 'CONFIRMED' ? 'ACTIVE' : webhookData.payment.status,
                  updated_at: new Date()
                },
                $push: {
                  status_history: {
                    status: webhookData.payment.status,
                    payment_id: webhookData.payment.id,
                    timestamp: new Date(),
                    source: 'webhook'
                  }
                }
              }
            );
            
            console.log(`Status da assinatura ${subscriptionId} atualizado para ${webhookData.payment.status}`);
          } else {
            console.warn(`Assinatura ${subscriptionId} não encontrada no banco de dados`);
            
            // Registrar assinaturas não encontradas para reconciliação posterior
            await db.collection('subscription_reconciliation_queue').insertOne({
              subscription_id: subscriptionId,
              reason: 'not_found_in_webhook',
              webhook_data: webhookData,
              created_at: new Date(),
              processed: false
            });
          }
        }
        
        // Atualizar status de pagamento, se aplicável
        if (webhookData.payment?.id) {
          const paymentId = webhookData.payment.id;
          
          await db.collection('payments').updateOne(
            { payment_id: paymentId },
            { 
              $set: { 
                status: webhookData.payment.status,
                updated_at: new Date(),
                webhook_update: true
              },
              $push: {
                status_history: {
                  status: webhookData.payment.status,
                  timestamp: new Date(),
                  source: 'webhook'
                }
              }
            },
            { upsert: true }
          );
          
          console.log(`Status do pagamento ${paymentId} atualizado para ${webhookData.payment.status}`);
        }
        
        // Marcar evento bruto como processado
        await db.collection('asaas_events_raw').updateOne(
          { _id: rawEvent.insertedId },
          { 
            $set: { 
              processed: true,
              processed_at: new Date()
            }
          }
        );
      } catch (dbError) {
        console.error('Erro ao processar webhook no MongoDB:', dbError.message);
        
        // Se já estabelecemos conexão com o banco, registrar o erro para processamento posterior
        if (dbConnected && client) {
          try {
            const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
            
            // Registrar evento com erro para reprocessamento
            await db.collection('asaas_events_failed').insertOne({
              event_type: webhookData.event,
              raw_data: webhookData,
              error: dbError.message,
              created_at: new Date(),
              retries: 0,
              last_retry: null
            });
            
            console.log('Erro registrado na fila de reprocessamento');
          } catch (logError) {
            console.error('Erro ao registrar falha de webhook:', logError.message);
          }
        }
      }
    }

    return; // Resposta já foi enviada anteriormente
  } catch (error) {
    console.error('Erro ao processar webhook:', error.message);
    
    // Apenas envia resposta se ainda não tiver respondido
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar webhook',
        message: error.message
      });
    }
    
    return;
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Erro ao fechar conexão com MongoDB:', closeError.message);
      }
    }
  }
}; 