const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const crypto = require('crypto');

// Configuração de ambiente
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// URL base da API Asaas
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

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

// Inicialização do cliente Supabase
const initSupabase = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
};

// Função para registrar logs de eventos
const logEvent = async (supabase, event) => {
  try {
    // Criar uma versão segura do evento sem dados sensíveis
    const safeEvent = {
      event: event.event,
      payment: event.payment ? {
        id: event.payment.id,
        status: event.payment.status,
        subscription: event.payment.subscription,
        customer: event.payment.customer,
        value: event.payment.value,
        billingType: event.payment.billingType,
        dueDate: event.payment.dueDate
      } : null
    };
    
    const { error } = await supabase
      .from('webhook_logs')
      .insert({
        provider: 'asaas',
        event_type: event.event,
        payload: JSON.stringify(safeEvent),
        created_at: new Date().toISOString()
      });
    
    if (error) console.error('Erro ao registrar log:', error);
  } catch (err) {
    console.error('Erro ao salvar log de webhook:', err);
  }
};

// Função para buscar detalhes da assinatura
const getSubscriptionDetails = async (subscriptionId) => {
  try {
    if (!ASAAS_API_KEY) {
      throw new Error('API key do Asaas não configurada');
    }
    
    const response = await axios({
      method: 'get',
      url: `${API_BASE_URL}/subscriptions/${subscriptionId}`,
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar detalhes da assinatura:', error.message);
    throw error;
  }
};

// Função para buscar detalhes do pagamento
const getPaymentDetails = async (paymentId) => {
  try {
    if (!ASAAS_API_KEY) {
      throw new Error('API key do Asaas não configurada');
    }
    
    const response = await axios({
      method: 'get',
      url: `${API_BASE_URL}/payments/${paymentId}`,
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar detalhes do pagamento:', error.message);
    throw error;
  }
};

// Função para atualizar o status da assinatura
const updateSubscriptionStatus = async (supabase, subscriptionId, status, endDate = null) => {
  const updateData = {
    status,
    updated_at: new Date().toISOString()
  };
  
  if (endDate) {
    updateData.end_date = endDate;
  }
  
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('payment_id', subscriptionId)
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao atualizar status da assinatura:', error);
    throw error;
  }
  
  return data;
};

// Função para notificar o usuário sobre mudanças na assinatura
const notifyUser = async (supabase, userId, title, message, type = 'info') => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        read: false,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Erro ao criar notificação:', error);
    }
  } catch (err) {
    console.error('Erro ao notificar usuário:', err);
  }
};

// Manipulador principal do webhook
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, X-Signature');

  // Responder a solicitações OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificação simples para solicitações GET
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'Webhook endpoint ativo e esperando eventos do Asaas' });
  }

  // Apenas aceitar solicitações POST para processamento de eventos
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  // Verificar rate limit por IP
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Taxa de requisições excedida. Tente novamente mais tarde.'
    });
  }

  // Log de diagnóstico (sem dados sensíveis)
  console.log('Headers recebidos:', {
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent'],
    'x-signature': req.headers['x-signature'] ? 'Presente' : 'Ausente'
  });
  
  let supabase;
  
  try {
    // Inicializar cliente Supabase
    supabase = initSupabase();
    
    // Extrair dados do webhook
    const webhookData = req.body;
    
    // Verificar assinatura do webhook
    const signature = req.headers['x-signature'];
    if (!verifyAsaasSignature(webhookData, signature)) {
      console.warn('Assinatura de webhook inválida ou ausente');
      return res.status(401).json({
        success: false,
        error: 'Assinatura inválida'
      });
    }
    
    // Registrar o evento recebido
    await logEvent(supabase, webhookData);
    
    // Verificar se há dados de pagamento
    if (!webhookData.payment) {
      return res.status(400).json({ error: 'Dados de pagamento não fornecidos' });
    }
    
    const payment = webhookData.payment;
    const eventType = webhookData.event;
    const subscriptionId = payment.subscription;
    
    // Se não for um evento de assinatura, ignorar
    if (!subscriptionId) {
      return res.status(200).json({ message: 'Evento não relacionado a uma assinatura' });
    }
    
    // Buscar a assinatura no banco de dados
    const { data: subscriptionData, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*, plans(*), users(*)')
      .eq('payment_id', subscriptionId)
      .single();
    
    if (fetchError || !subscriptionData) {
      console.error('Assinatura não encontrada:', subscriptionId);
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }
    
    const userId = subscriptionData.user_id;
    const planName = subscriptionData.plans?.name || 'desconhecido';
    
    // Processar o evento com base no tipo
    switch (eventType) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        // Atualizar assinatura para ativa
        await updateSubscriptionStatus(supabase, subscriptionId, 'active');
        
        // Notificar o usuário
        await notifyUser(
          supabase, 
          userId,
          'Pagamento confirmado',
          `Seu pagamento para o plano ${planName} foi confirmado. Sua assinatura está ativa.`,
          'success'
        );
        
        console.log(`Assinatura ${subscriptionId} ativada com sucesso`);
        break;
      }
      
      case 'PAYMENT_OVERDUE': {
        // Atualizar assinatura para atrasada
        await updateSubscriptionStatus(supabase, subscriptionId, 'overdue');
        
        // Notificar o usuário
        await notifyUser(
          supabase, 
          userId,
          'Pagamento atrasado',
          `Seu pagamento para o plano ${planName} está atrasado. Por favor, regularize para manter seu acesso.`,
          'warning'
        );
        
        console.log(`Assinatura ${subscriptionId} marcada como atrasada`);
        break;
      }
      
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK': {
        // Atualizar assinatura para cancelada
        await updateSubscriptionStatus(
          supabase, 
          subscriptionId, 
          'canceled', 
          new Date().toISOString()
        );
        
        // Notificar o usuário
        await notifyUser(
          supabase,
          userId,
          'Assinatura cancelada',
          `Sua assinatura do plano ${planName} foi cancelada devido a um ${
            eventType === 'PAYMENT_REFUNDED' ? 'reembolso' : 
            eventType === 'PAYMENT_CHARGEBACK' ? 'estorno' : 'cancelamento'
          } do pagamento.`,
          'error'
        );
        
        console.log(`Assinatura ${subscriptionId} cancelada devido a ${eventType}`);
        break;
      }
      
      case 'SUBSCRIPTION_CANCELLED': {
        // Atualizar assinatura para cancelada
        await updateSubscriptionStatus(
          supabase, 
          subscriptionId, 
          'canceled', 
          new Date().toISOString()
        );
        
        // Notificar o usuário
        await notifyUser(
          supabase,
          userId,
          'Assinatura cancelada',
          `Sua assinatura do plano ${planName} foi cancelada conforme solicitado.`,
          'info'
        );
        
        console.log(`Assinatura ${subscriptionId} cancelada pelo usuário ou sistema`);
        break;
      }
      
      default:
        console.log(`Evento ${eventType} não processado diretamente`);
    }
    
    return res.status(200).json({ 
      success: true, 
      message: `Evento ${eventType} processado com sucesso`
    });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
}; 