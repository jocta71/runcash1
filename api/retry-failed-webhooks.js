// Script para reprocessar webhooks que falharam
const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações POST com autenticação
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verificar autenticação para este endpoint administrativo
  const apiKey = req.headers['x-api-key'] || '';
  if (apiKey !== process.env.ADMIN_API_KEY) {
    console.warn('Tentativa de acesso não autorizado ao processamento de webhooks');
    return res.status(401).json({ error: 'Não autorizado' });
  }

  let client;
  const retryResults = {
    processed: 0,
    successful: 0,
    failed: 0,
    details: []
  };

  try {
    // Configuração do cliente MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    
    // Obter limite de eventos a processar (padrão: 20)
    const limit = req.body.limit || 20;
    const maxRetries = req.body.maxRetries || 3;

    console.log(`Iniciando reprocessamento de até ${limit} eventos falhos (máximo de ${maxRetries} tentativas)`);

    // Buscar eventos falhos que ainda não excederam o número máximo de tentativas
    const failedEvents = await db.collection('asaas_events_failed')
      .find({ 
        retries: { $lt: maxRetries },
        processed: { $ne: true }
      })
      .sort({ created_at: 1 }) // Processar os mais antigos primeiro
      .limit(limit)
      .toArray();

    console.log(`Encontrados ${failedEvents.length} eventos para reprocessamento`);

    // Processar cada evento falho
    for (const event of failedEvents) {
      retryResults.processed++;
      
      try {
        console.log(`Reprocessando evento ${event._id} (tentativa ${event.retries + 1} de ${maxRetries})`);
        
        const webhookData = event.raw_data;
        
        // Validar dados do webhook
        if (!webhookData || !webhookData.event) {
          throw new Error('Dados de webhook inválidos');
        }

        // Processar informações da assinatura e pagamento
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
                  updated_at: new Date(),
                  retry_processed: true
                },
                $push: {
                  status_history: {
                    status: webhookData.payment.status,
                    payment_id: webhookData.payment.id,
                    timestamp: new Date(),
                    source: 'webhook_retry'
                  }
                }
              }
            );
            
            console.log(`Status da assinatura ${subscriptionId} atualizado para ${webhookData.payment.status}`);
          } else {
            console.warn(`Assinatura ${subscriptionId} não encontrada no banco de dados`);
            
            // Adicionar à fila de reconciliação se ainda não estiver lá
            await db.collection('subscription_reconciliation_queue').updateOne(
              { 
                subscription_id: subscriptionId,
                reason: 'not_found_in_webhook'
              },
              {
                $set: {
                  webhook_data: webhookData,
                  updated_at: new Date()
                },
                $setOnInsert: {
                  created_at: new Date(),
                  processed: false
                }
              },
              { upsert: true }
            );
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
                webhook_retry_update: true
              },
              $push: {
                status_history: {
                  status: webhookData.payment.status,
                  timestamp: new Date(),
                  source: 'webhook_retry'
                }
              }
            },
            { upsert: true }
          );
          
          console.log(`Status do pagamento ${paymentId} atualizado para ${webhookData.payment.status}`);
        }
        
        // Registrar evento processado se não existir
        await db.collection('asaas_events').updateOne(
          { 
            event_type: webhookData.event,
            payment_id: webhookData.payment?.id
          },
          {
            $set: {
              retry_processed: true,
              updated_at: new Date()
            },
            $setOnInsert: {
              event_type: webhookData.event,
              payment_id: webhookData.payment?.id,
              subscription_id: webhookData.payment?.subscription,
              customer_id: webhookData.payment?.customer,
              status: webhookData.payment?.status,
              value: webhookData.payment?.value,
              raw_data: webhookData,
              created_at: new Date()
            }
          },
          { upsert: true }
        );
        
        // Marcar evento como processado
        await db.collection('asaas_events_failed').updateOne(
          { _id: event._id },
          {
            $set: {
              processed: true,
              processed_at: new Date(),
              success: true
            },
            $inc: { retries: 1 },
            $push: {
              retry_history: {
                timestamp: new Date(),
                success: true
              }
            }
          }
        );
        
        retryResults.successful++;
        retryResults.details.push({
          event_id: event._id.toString(),
          payment_id: webhookData.payment?.id,
          subscription_id: webhookData.payment?.subscription,
          result: 'success'
        });
      } catch (error) {
        console.error(`Erro ao reprocessar evento ${event._id}:`, error.message);
        
        // Atualizar contador de tentativas
        await db.collection('asaas_events_failed').updateOne(
          { _id: event._id },
          {
            $inc: { retries: 1 },
            $set: {
              last_retry: new Date(),
              last_error: error.message,
              processed: event.retries + 1 >= maxRetries // Marcar como processado se atingiu o limite
            },
            $push: {
              retry_history: {
                timestamp: new Date(),
                success: false,
                error: error.message
              }
            }
          }
        );
        
        retryResults.failed++;
        retryResults.details.push({
          event_id: event._id.toString(),
          payment_id: event.raw_data?.payment?.id,
          subscription_id: event.raw_data?.payment?.subscription,
          result: 'failed',
          error: error.message
        });
      }
    }

    // Registrar execução da rotina
    await db.collection('admin_logs').insertOne({
      type: 'webhook_retry',
      results: retryResults,
      timestamp: new Date()
    });

    console.log('Reprocessamento de webhooks concluído:', retryResults);
    
    return res.status(200).json({
      success: true,
      retry_results: retryResults
    });
  } catch (error) {
    console.error('Erro durante reprocessamento de webhooks:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Erro durante reprocessamento',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 