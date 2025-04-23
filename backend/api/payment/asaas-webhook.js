const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configurações da API Asaas
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

console.log(`[WEBHOOK] Usando Asaas em ambiente: ${ASAAS_ENVIRONMENT}`);

module.exports = async (req, res) => {
  // Configurar CORS para aceitar qualquer origem
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

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

  let client;

  try {
    const webhookData = req.body;
    console.log('Evento recebido do Asaas:', webhookData);
    
    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    // Registrar o log do webhook
    await db.collection('webhook_logs').insertOne({
      provider: 'asaas',
      event_type: webhookData.event,
      payload: webhookData,
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
      console.log('Pagamento não relacionado a uma assinatura', payment);
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