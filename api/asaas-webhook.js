const { MongoClient } = require('mongodb');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Asaas-Signature');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações POST
  if (req.method !== 'POST') {
    console.log("[WEBHOOK_SECURITY] Método não permitido:", req.method);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client;
  
  try {
    // Verificar origem do webhook (IPs do Asaas)
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Lista de IPs permitidos do Asaas (atualize com os IPs reais do Asaas)
    // Exemplo: const ALLOWED_IPS = ['177.71.206.25', '177.71.206.30'];
    // Para teste, mantenha esta variável vazia para permitir qualquer IP
    const ALLOWED_IPS = [];
    
    if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(clientIp)) {
      console.error(`[WEBHOOK_SECURITY] IP não autorizado tentando acessar webhook: ${clientIp}`);
      await logWebhookSecurity({
        type: 'UNAUTHORIZED_IP',
        ip: clientIp,
        headers: req.headers,
        timestamp: new Date()
      });
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }
    
    // Verificar assinatura do webhook (se a chave estiver configurada)
    const WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET;
    
    if (WEBHOOK_SECRET) {
      const signature = req.headers['x-asaas-signature'];
      
      if (!signature) {
        console.error('[WEBHOOK_SECURITY] Cabeçalho X-Asaas-Signature ausente');
        await logWebhookSecurity({
          type: 'MISSING_SIGNATURE',
          ip: clientIp,
          headers: req.headers,
          timestamp: new Date()
        });
        return res.status(401).json({ error: 'Assinatura não fornecida' });
      }
      
      // Computar HMAC do corpo da requisição
      const requestBody = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(requestBody)
        .digest('hex');
      
      // Verificar se a assinatura corresponde
      if (signature !== expectedSignature) {
        console.error('[WEBHOOK_SECURITY] Assinatura inválida');
        await logWebhookSecurity({
          type: 'INVALID_SIGNATURE',
          ip: clientIp,
          headers: req.headers,
          providedSignature: signature,
          expectedSignature: expectedSignature,
          timestamp: new Date()
        });
        return res.status(401).json({ error: 'Assinatura inválida' });
      }
      
      console.log('[WEBHOOK_SECURITY] Assinatura validada com sucesso');
    } else {
      console.warn('[WEBHOOK_SECURITY] ASAAS_WEBHOOK_SECRET não configurado. A autenticidade do webhook não pode ser verificada.');
    }

    const webhookData = req.body;
    console.log('Webhook recebido do Asaas:', JSON.stringify(webhookData));

    // Validar dados do webhook
    if (!webhookData || !webhookData.event) {
      await logWebhookSecurity({
        type: 'INVALID_PAYLOAD',
        ip: clientIp,
        payload: webhookData,
        timestamp: new Date()
      });
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
        
        // Registrar evento no MongoDB com detalhes de segurança
        await db.collection('asaas_events').insertOne({
          event_type: webhookData.event,
          payment_id: webhookData.payment?.id,
          subscription_id: webhookData.payment?.subscription,
          customer_id: webhookData.payment?.customer,
          status: webhookData.payment?.status,
          value: webhookData.payment?.value,
          raw_data: webhookData,
          security: {
            ip: clientIp,
            headers: {
              host: req.headers.host,
              'user-agent': req.headers['user-agent'],
              'x-asaas-signature': req.headers['x-asaas-signature']
            },
            verified: !!WEBHOOK_SECRET
          },
          created_at: new Date()
        });
        
        console.log('Evento Asaas registrado no MongoDB com dados de segurança');
        
        // Atualizar status da assinatura, se aplicável
        if (webhookData.payment?.subscription) {
          const subscriptionId = webhookData.payment.subscription;
          
          // Verificar se a assinatura existe
          const existingSubscription = await db.collection('subscriptions').findOne({
            subscription_id: subscriptionId
          });
          
          if (existingSubscription) {
            // Verificar se o status já foi processado antes (evitar duplicação)
            const alreadyProcessed = await db.collection('asaas_events').findOne({
              event_type: webhookData.event,
              payment_id: webhookData.payment.id,
              'raw_data.payment.status': webhookData.payment.status
            });
            
            if (alreadyProcessed) {
              console.log(`Evento já processado anteriormente para o pagamento ${webhookData.payment.id}. Evitando duplicação.`);
              return res.status(200).json({ success: true, message: 'Evento já processado anteriormente' });
            }
            
            // Criar entrada de auditoria antes da atualização
            await db.collection('subscription_audit').insertOne({
              subscription_id: subscriptionId,
              payment_id: webhookData.payment.id,
              previous_status: existingSubscription.status,
              new_status: webhookData.payment.status === 'CONFIRMED' ? 'ACTIVE' : webhookData.payment.status,
              event_type: webhookData.event,
              changed_by: 'webhook',
              webhook_data: webhookData,
              security: {
                ip: clientIp,
                signature_verified: !!WEBHOOK_SECRET
              },
              timestamp: new Date()
            });
            
            // Atualizar o status da assinatura
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
                    source: 'webhook',
                    ip: clientIp,
                    verified: !!WEBHOOK_SECRET
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
              security: {
                ip: clientIp,
                verified: !!WEBHOOK_SECRET
              },
              created_at: new Date(),
              processed: false
            });
          }
        }
        
        return res.status(200).json({ 
          success: true,
          message: 'Webhook processado com sucesso' 
        });
      } catch (dbError) {
        console.error('Erro ao acessar MongoDB:', dbError.message);
        throw dbError;
      }
    } else {
      // MongoDB não configurado
      return res.status(200).json({ 
        success: true,
        message: 'Webhook recebido, mas MongoDB não está configurado' 
      });
    }
  } catch (error) {
    console.error('Erro ao processar webhook:', error.message);
    return res.status(500).json({ 
      success: false,
      error: 'Erro interno no servidor' 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
};

// Função para registrar eventos de segurança (mesmo sem MongoDB)
async function logWebhookSecurity(data) {
  console.error(`[WEBHOOK_SECURITY] ${data.type}: ${JSON.stringify(data)}`);
  
  // Se o MongoDB estiver disponível, registrar no banco de dados
  if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
    try {
      const client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
      
      await db.collection('security_logs').insertOne({
        source: 'webhook',
        ...data
      });
      
      await client.close();
    } catch (err) {
      console.error('Erro ao registrar log de segurança no MongoDB:', err.message);
    }
  }
} 