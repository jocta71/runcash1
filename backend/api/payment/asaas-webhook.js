const { MongoClient } = require('mongodb');
const axios = require('axios');
const crypto = require('crypto');

// Configurações da API Asaas
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

console.log(`[WEBHOOK] Usando Asaas em ambiente: ${ASAAS_ENVIRONMENT}`);

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
  } else {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, X-Signature');

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
    console.log('Evento recebido do Asaas - Tipo:', webhookData.event || 'desconhecido');
    
    // Verificar assinatura do webhook
    const signature = req.headers['x-signature'];
    if (!verifyAsaasSignature(webhookData, signature)) {
      console.warn('Assinatura de webhook inválida ou ausente');
      return res.status(401).json({
        success: false,
        error: 'Assinatura inválida'
      });
    }
    
    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    // Registrar o log do webhook (sem dados sensíveis completos)
    const safePayload = {
      event: webhookData.event,
      payment: webhookData.payment ? {
        id: webhookData.payment.id,
        status: webhookData.payment.status,
        subscription: webhookData.payment.subscription,
        customer: webhookData.payment.customer,
        value: webhookData.payment.value,
        billingType: webhookData.payment.billingType
      } : null
    };
    
    await db.collection('webhook_logs').insertOne({
      provider: 'asaas',
      event_type: webhookData.event,
      payload: safePayload,
      created_at: new Date()
    });
    
    // Processar diferentes tipos de eventos
    const eventType = webhookData.event;
    const payment = webhookData.payment;
    
    if (!payment) {
      return res.status(400).json({ error: 'Dados de pagamento não fornecidos' });
    }
    
    // Obter ID da assinatura do pagamento
    const subscriptionId = payment.subscription;
    
    if (!subscriptionId) {
      console.log('Pagamento não relacionado a uma assinatura', payment.id);
      return res.status(200).json({ message: 'Evento ignorado - não é uma assinatura' });
    }
    
    // Buscar assinatura no MongoDB pelo payment_id
    const subscriptionData = await db.collection('subscriptions').findOne({
      payment_id: subscriptionId
    });
      
    if (!subscriptionData) {
      console.error('Assinatura não encontrada no banco de dados:', subscriptionId);
      return res.status(404).json({ error: 'Assinatura não encontrada', subscription_id: subscriptionId });
    }
    
    // Processar eventos
    let status, endDate;
    
    switch (eventType) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        status = 'active';
        break;
      case 'PAYMENT_OVERDUE':
        status = 'overdue';
        break;
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_REQUESTED':
      case 'SUBSCRIPTION_CANCELLED':
        status = 'canceled';
        endDate = new Date();
        break;
      default:
        console.log(`Evento não processado: ${eventType}`);
        return res.status(200).json({ 
          success: true, 
          message: `Evento ${eventType} não requer atualização de status` 
        });
    }
    
    // Atualizar assinatura
    const updateData = {
      status,
      updated_at: new Date()
    };
    
    if (endDate) {
      updateData.end_date = endDate;
    }
    
    await db.collection('subscriptions').updateOne(
      { _id: subscriptionData._id },
      { $set: updateData }
    );
    
    console.log(`Assinatura ${subscriptionData._id} atualizada para ${status}`);
    
    // Adicionar notificação para o usuário
    const notificationTitle = status === 'active' 
      ? 'Pagamento confirmado' 
      : status === 'overdue' 
        ? 'Pagamento atrasado' 
        : 'Assinatura cancelada';
    
    const notificationMessage = status === 'active' 
      ? 'Seu pagamento foi confirmado e sua assinatura está ativa.' 
      : status === 'overdue' 
        ? 'Seu pagamento está atrasado. Por favor, regularize para manter seu acesso.' 
        : 'Sua assinatura foi cancelada.';
    
    await db.collection('notifications').insertOne({
      user_id: subscriptionData.user_id,
      title: notificationTitle,
      message: notificationMessage,
      type: status === 'active' ? 'success' : status === 'overdue' ? 'warning' : 'error',
      read: false,
      created_at: new Date()
    });
    
    return res.status(200).json({ 
      success: true, 
      message: `Evento ${eventType} processado com sucesso` 
    });
  } catch (error) {
    console.error('Erro ao processar webhook do Asaas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 