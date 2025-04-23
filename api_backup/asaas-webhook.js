// Endpoint para receber notificações de webhook do Asaas
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

// Cache simples para implementar rate limiting
const rateLimitCache = {
  requests: {},
  resetTime: Date.now() + 3600000, // Reset a cada hora
  limit: 100 // Limite de 100 requisições por IP por hora
};

// Função para verificar rate limiting
const checkRateLimit = (ip) => {
  // Reset cache se necessário
  if (Date.now() > rateLimitCache.resetTime) {
    rateLimitCache.requests = {};
    rateLimitCache.resetTime = Date.now() + 3600000;
  }
  
  // Inicializar contador para este IP
  if (!rateLimitCache.requests[ip]) {
    rateLimitCache.requests[ip] = 0;
  }
  
  // Incrementar contador
  rateLimitCache.requests[ip]++;
  
  // Verificar se excedeu o limite
  return rateLimitCache.requests[ip] <= rateLimitCache.limit;
};

// Função para verificar a assinatura do webhook
const verifyAsaasSignature = (payload, signature) => {
  if (!process.env.ASAAS_WEBHOOK_SECRET) {
    console.warn('AVISO: ASAAS_WEBHOOK_SECRET não configurado, pulando verificação de assinatura');
    return true;
  }
  
  if (!signature) {
    console.warn('AVISO: Assinatura não fornecida no webhook');
    return false;
  }
  
  try {
    const hmac = crypto.createHmac('sha256', process.env.ASAAS_WEBHOOK_SECRET);
    const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
    
    // Comparação segura para evitar timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error.message);
    return false;
  }
};

module.exports = async (req, res) => {
  // Configuração de CORS para permitir apenas domínios confiáveis
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://www.asaas.com',
    'https://sandbox.asaas.com'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, X-Signature');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  // Verificar rate limit por IP
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Taxa de requisições excedida. Tente novamente mais tarde.'
    });
  }

  let client;
  
  try {
    const webhookData = req.body;
    
    // Log limitado (sem dados sensíveis)
    console.log('Webhook recebido do Asaas - Evento:', webhookData.event || 'desconhecido');

    // Validar dados do webhook
    if (!webhookData || !webhookData.event) {
      return res.status(400).json({
        success: false,
        error: 'Dados de webhook inválidos'
      });
    }
    
    // Verificar assinatura do webhook
    const signature = req.headers['x-signature'];
    if (!verifyAsaasSignature(webhookData, signature)) {
      console.warn('Assinatura de webhook inválida ou ausente');
      return res.status(401).json({
        success: false,
        error: 'Assinatura inválida'
      });
    }

    // Processar apenas se o MongoDB estiver habilitado
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        // Registrar evento no MongoDB (sem dados sensíveis completos)
        const safePaymentData = webhookData.payment ? {
          id: webhookData.payment.id,
          subscription: webhookData.payment.subscription,
          customer: webhookData.payment.customer,
          status: webhookData.payment.status,
          value: webhookData.payment.value,
          // Omitir dados sensíveis do log
          billingType: webhookData.payment.billingType
        } : null;
        
        await db.collection('asaas_events').insertOne({
          event_type: webhookData.event,
          payment_id: webhookData.payment?.id,
          subscription_id: webhookData.payment?.subscription,
          customer_id: webhookData.payment?.customer,
          status: webhookData.payment?.status,
          value: webhookData.payment?.value,
          raw_data: safePaymentData, // Armazenar versão limitada dos dados
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