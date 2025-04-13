/**
 * Handler para o webhook do Asaas (implementação direta)
 * 
 * Este arquivo processa diretamente os webhooks do Asaas sem depender
 * do arquivo em backend/api/payment/asaas-webhook.js
 */

// Módulos necessários
const { MongoClient } = require('mongodb');

// Configurações
const MONGODB_URI = process.env.MONGODB_URI;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'production';
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

// Handler principal do webhook
module.exports = async (req, res) => {
  console.log('[ASAAS WEBHOOK] Recebida requisição no caminho /api/asaas-webhook');
  console.log('[ASAAS WEBHOOK] Método:', req.method);
  
  // Configurar CORS para aceitar qualquer origem
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Responder a requisições preflight OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    console.log('[ASAAS WEBHOOK] Respondendo requisição OPTIONS com 200 OK');
    return res.status(200).end();
  }

  // Para requisições GET (verificação do webhook)
  if (req.method === 'GET') {
    console.log('[ASAAS WEBHOOK] Recebida verificação GET do webhook');
    return res.status(200).json({ 
      status: 'Webhook endpoint ativo. Use POST para eventos do Asaas.',
      timestamp: new Date().toISOString() 
    });
  }

  if (req.method !== 'POST') {
    console.error('[ASAAS WEBHOOK] Método não permitido:', req.method);
    return res.status(405).json({ error: 'Method Not Allowed', method: req.method });
  }

  try {
    // Debug dos dados recebidos
    console.log('[ASAAS WEBHOOK] Headers recebidos:', req.headers);
    console.log('[ASAAS WEBHOOK] Corpo da requisição:', req.body);
    
    const webhookData = req.body;
    console.log('[ASAAS WEBHOOK] Evento recebido:', webhookData.event);
    
    // Processar apenas se a conexão MongoDB estiver configurada
    if (!MONGODB_URI) {
      console.warn('[ASAAS WEBHOOK] URI do MongoDB não configurada. Usando modo simulado.');
      return res.status(200).json({ 
        success: true, 
        message: 'Evento recebido. Processamento simulado (sem MongoDB).',
        event: webhookData.event || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
    
    // Processar diferentes tipos de eventos
    const eventType = webhookData.event;
    const payment = webhookData.payment;
    
    if (!payment) {
      console.error('[ASAAS WEBHOOK] Dados de pagamento não fornecidos');
      return res.status(400).json({ error: 'Dados de pagamento não fornecidos' });
    }
    
    // Obter ID da assinatura do pagamento
    const subscriptionId = payment.subscription;
    
    if (!subscriptionId) {
      console.log('[ASAAS WEBHOOK] Pagamento não relacionado a uma assinatura', payment);
      return res.status(200).json({ message: 'Evento ignorado - não é uma assinatura' });
    }
    
    // Conectar ao MongoDB
    console.log('[ASAAS WEBHOOK] Conectando ao MongoDB...');
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    // Obter a coleção de assinaturas
    const db = client.db('runcash');
    const subscriptionsCollection = db.collection('subscriptions');
    
    // Buscar assinatura pelo payment_id
    const subscriptionData = await subscriptionsCollection.findOne({ payment_id: subscriptionId });
    
    if (!subscriptionData) {
      console.error('[ASAAS WEBHOOK] Assinatura não encontrada no banco de dados:', subscriptionId);
      await client.close();
      return res.status(404).json({ error: 'Assinatura não encontrada', subscription_id: subscriptionId });
    }
    
    console.log('[ASAAS WEBHOOK] Assinatura encontrada:', subscriptionData._id);
    
    // Determinar o novo status com base no tipo de evento
    let newStatus;
    let updateFields = {
      updated_at: new Date().toISOString()
    };
    
    switch (eventType) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        newStatus = 'active';
        break;
      case 'PAYMENT_OVERDUE':
        newStatus = 'overdue';
        break;
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_REQUESTED':
      case 'SUBSCRIPTION_CANCELLED':
        newStatus = 'canceled';
        updateFields.end_date = new Date().toISOString();
        break;
      default:
        console.log(`[ASAAS WEBHOOK] Evento não processado: ${eventType}`);
        await client.close();
        return res.status(200).json({ 
          success: true, 
          message: `Evento ${eventType} não requer atualização de status` 
        });
    }
    
    updateFields.status = newStatus;
    
    // Atualizar assinatura
    console.log(`[ASAAS WEBHOOK] Atualizando assinatura ${subscriptionData._id} para status: ${newStatus}`);
    
    const updateResult = await subscriptionsCollection.updateOne(
      { _id: subscriptionData._id },
      { $set: updateFields }
    );
    
    console.log('[ASAAS WEBHOOK] Resultado da atualização:', updateResult);
    
    // Fechar conexão com MongoDB
    await client.close();
    
    return res.status(200).json({
      success: true,
      message: `Evento ${eventType} processado com sucesso`,
      subscription_id: subscriptionData._id,
      new_status: newStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ASAAS WEBHOOK] Erro ao processar webhook:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor', 
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
}; 