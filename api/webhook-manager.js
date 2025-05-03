// Gerenciador unificado de webhooks e reconciliação
// Este arquivo consolida várias funções relacionadas a webhooks em um único endpoint
const { MongoClient } = require('mongodb');
const axios = require('axios');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Api-Key');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Identificar a operação a ser realizada com base no path ou query parameter
  const url = new URL(req.url, `http://${req.headers.host}`);
  const operation = url.searchParams.get('operation') || 'webhook'; // webhook, reconciliation, retry
  
  // Executar a operação correspondente
  switch (operation) {
    case 'webhook':
      return handleWebhook(req, res);
    case 'reconciliation':
      return handleReconciliation(req, res);
    case 'retry':
      return handleRetry(req, res);
    default:
      return res.status(400).json({
        success: false,
        error: 'Operação inválida'
      });
  }
};

// Função para lidar com webhooks
async function handleWebhook(req, res) {
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
}

// Função para lidar com reconciliação
async function handleReconciliation(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verificar autenticação para este endpoint administrativo
  const apiKey = req.headers['x-api-key'] || '';
  if (apiKey !== process.env.ADMIN_API_KEY) {
    console.warn('Tentativa de acesso não autorizado à reconciliação de assinaturas');
    return res.status(401).json({ error: 'Não autorizado' });
  }

  let client;
  const reconciliationResults = {
    processed: 0,
    updated: 0,
    errors: 0,
    details: []
  };

  try {
    // Configuração do cliente MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    const subscriptionsCollection = db.collection('subscriptions');

    // Configuração da API do Asaas
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    const API_URL = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!ASAAS_API_KEY) {
      return res.status(500).json({ 
        success: false,
        error: 'Chave de API do Asaas não configurada' 
      });
    }

    // Configuração do cliente HTTP para Asaas
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      }
    });

    // Buscar assinaturas locais
    console.log('Iniciando reconciliação de assinaturas...');
    
    // Limite para processamento em lotes (evitar sobrecarga)
    const limit = req.body.limit || 100;
    const subscriptions = await subscriptionsCollection
      .find({})
      .limit(limit)
      .toArray();

    console.log(`Processando ${subscriptions.length} assinaturas`);

    // Processar cada assinatura
    for (const subscription of subscriptions) {
      reconciliationResults.processed++;
      
      try {
        // Buscar dados atualizados na API do Asaas
        console.log(`Verificando assinatura ${subscription.subscription_id}`);
        const asaasResponse = await apiClient.get(`/subscriptions/${subscription.subscription_id}`);
        
        if (!asaasResponse || !asaasResponse.data) {
          throw new Error('Resposta inválida da API do Asaas');
        }

        const asaasSubscription = asaasResponse.data;
        
        // Verificar se há diferenças entre os dados locais e da API
        if (
          subscription.status !== asaasSubscription.status ||
          subscription.next_due_date !== asaasSubscription.nextDueDate
        ) {
          // Atualizar registro local
          console.log(`Atualizando assinatura ${subscription.subscription_id}: ${subscription.status} -> ${asaasSubscription.status}`);
          
          await subscriptionsCollection.updateOne(
            { subscription_id: subscription.subscription_id },
            {
              $set: {
                status: asaasSubscription.status,
                next_due_date: asaasSubscription.nextDueDate,
                value: asaasSubscription.value,
                last_reconciliation: new Date(),
                updated_at: new Date()
              },
              $push: {
                reconciliation_log: {
                  timestamp: new Date(),
                  previous_status: subscription.status,
                  new_status: asaasSubscription.status,
                  source: 'reconciliation'
                }
              }
            }
          );
          
          reconciliationResults.updated++;
          reconciliationResults.details.push({
            subscription_id: subscription.subscription_id,
            action: 'updated',
            previous_status: subscription.status,
            new_status: asaasSubscription.status
          });
        } else {
          // Apenas registrar verificação
          await subscriptionsCollection.updateOne(
            { subscription_id: subscription.subscription_id },
            {
              $set: {
                last_reconciliation: new Date()
              }
            }
          );
        }
        
        // Se assinatura está ativa, verificar pagamentos recentes
        if (asaasSubscription.status === 'ACTIVE') {
          // Buscar pagamentos recentes desta assinatura
          const paymentsResponse = await apiClient.get('/payments', {
            params: { subscription: subscription.subscription_id }
          });
          
          if (paymentsResponse && paymentsResponse.data && paymentsResponse.data.data) {
            const payments = paymentsResponse.data.data;
            
            // Atualizar os pagamentos mais recentes
            for (const payment of payments) {
              await db.collection('payments').updateOne(
                { payment_id: payment.id },
                {
                  $set: {
                    status: payment.status,
                    value: payment.value,
                    net_value: payment.netValue,
                    due_date: payment.dueDate,
                    payment_date: payment.paymentDate,
                    updated_at: new Date(),
                    last_reconciliation: new Date()
                  }
                },
                { upsert: true }
              );
            }
          }
        }
      } catch (error) {
        console.error(`Erro ao reconciliar assinatura ${subscription.subscription_id}:`, error.message);
        reconciliationResults.errors++;
        reconciliationResults.details.push({
          subscription_id: subscription.subscription_id,
          action: 'error',
          error: error.message
        });
        
        // Registrar erro, mas continuar com outras assinaturas
        await subscriptionsCollection.updateOne(
          { subscription_id: subscription.subscription_id },
          {
            $set: {
              last_reconciliation_error: error.message,
              last_reconciliation_attempt: new Date()
            }
          }
        );
      }
    }

    // Registrar execução da reconciliação
    await db.collection('admin_logs').insertOne({
      type: 'subscription_reconciliation',
      results: reconciliationResults,
      timestamp: new Date()
    });

    console.log('Reconciliação concluída:', reconciliationResults);
    
    return res.status(200).json({
      success: true,
      reconciliation: reconciliationResults
    });
  } catch (error) {
    console.error('Erro durante reconciliação de assinaturas:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Erro durante reconciliação',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}

// Função para lidar com retry de webhooks
async function handleRetry(req, res) {
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
} 