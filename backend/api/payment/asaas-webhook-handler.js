const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configuração de ambiente
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// URL base da API Asaas
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

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
    const { error } = await supabase
      .from('webhook_logs')
      .insert({
        provider: 'asaas',
        event_type: event.event,
        payload: JSON.stringify(event),
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
  // Configurar CORS para permitir solicitações da Asaas
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

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

  console.log('Headers recebidos:', JSON.stringify(req.headers));
  console.log('Corpo da requisição:', JSON.stringify(req.body));

  let supabase;
  
  try {
    // Inicializar cliente Supabase
    supabase = initSupabase();
    
    // Extrair dados do webhook
    const webhookData = req.body;
    
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