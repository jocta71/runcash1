const axios = require('axios');

// API handler para o Vercel Serverless
module.exports = async (req, res) => {
  // Configurar CORS para todas as origens
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Lidar com requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar a chave da API da Hubla
  const hublaApiKey = process.env.HUBLA_API_KEY;
  if (!hublaApiKey) {
    console.error('HUBLA_API_KEY não configurada no ambiente');
    return res.status(500).json({ error: 'Configuração da API incompleta' });
  }

  // Para verificação do webhook pela Hubla (se necessário)
  if (req.method === 'GET') {
    return res.status(200).json({ message: 'Endpoint de webhook da Hubla configurado com sucesso' });
  }

  // Verificar se o método da requisição é POST para processar eventos
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter dados do corpo da requisição
    const eventData = req.body;
    console.log('Evento webhook recebido da Hubla:', JSON.stringify(eventData).substring(0, 200) + '...');

    // Verificar se é um evento válido
    if (!eventData || !eventData.event) {
      console.error('Formato inválido do webhook da Hubla');
      return res.status(400).json({ error: 'Formato inválido do webhook' });
    }

    // Verificar o token de segurança do webhook (se a Hubla fornecer)
    const hublaWebhookToken = process.env.HUBLA_WEBHOOK_TOKEN;
    if (hublaWebhookToken) {
      const receivedToken = req.headers['x-webhook-token'] || '';
      if (receivedToken !== hublaWebhookToken) {
        console.error('Token de segurança inválido do webhook da Hubla');
        return res.status(403).json({ error: 'Token de segurança inválido' });
      }
    }

    // Processar diferentes tipos de eventos
    const eventType = eventData.event;
    const resourceData = eventData.data || {};
    const resourceId = resourceData.id;

    console.log(`Processando evento ${eventType} para recurso ${resourceId}`);

    // Implementar lógica com base no tipo de evento
    switch (eventType) {
      case 'PAYMENT.CONFIRMED':
      case 'PAYMENT.RECEIVED':
      case 'PAYMENT.APPROVED':
        // Atualizar status de pagamento no banco de dados
        await handlePaymentConfirmed(resourceData);
        break;
        
      case 'PAYMENT.OVERDUE':
      case 'PAYMENT.DECLINED':
      case 'PAYMENT.FAILED':
        // Atualizar status para pagamento com falha
        await handlePaymentFailed(resourceData);
        break;
        
      case 'SUBSCRIPTION.CANCELLED':
        // Atualizar status de assinatura no banco de dados
        await handleSubscriptionCancelled(resourceData);
        break;
        
      case 'SUBSCRIPTION.RENEWED':
        // Processar renovação de assinatura
        await handleSubscriptionRenewed(resourceData);
        break;
        
      default:
        console.log(`Evento não processado: ${eventType}`);
    }

    // Responder ao webhook
    return res.status(200).json({ message: 'Evento processado com sucesso' });
    
  } catch (error) {
    console.error('Erro ao processar webhook da Hubla:', error.message);
    return res.status(500).json({ error: 'Erro interno ao processar webhook' });
  }
};

// Funções de manipulação de eventos (a serem implementadas conforme necessidade)
async function handlePaymentConfirmed(paymentData) {
  // Atualizar o status do pagamento no banco de dados
  console.log('Pagamento confirmado:', paymentData.id);
  
  // Aqui você deve implementar a lógica para atualizar seu banco de dados
  // Por exemplo, usando uma API interna ou um cliente de banco de dados
  
  try {
    // Exemplo: Notificar um serviço interno
    await axios.post(
      process.env.INTERNAL_API_URL + '/update-payment-status',
      {
        externalId: paymentData.id,
        status: 'PAID',
        paidDate: paymentData.confirmedDate || new Date().toISOString(),
        value: paymentData.value,
        externalReference: paymentData.externalReference
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    console.error('Erro ao atualizar status do pagamento:', err.message);
    // Continuar mesmo com erro para não falhar o webhook
  }
}

async function handlePaymentFailed(paymentData) {
  console.log('Pagamento com falha:', paymentData.id);
  
  try {
    // Exemplo: Notificar um serviço interno
    await axios.post(
      process.env.INTERNAL_API_URL + '/update-payment-status',
      {
        externalId: paymentData.id,
        status: 'FAILED',
        failReason: paymentData.failReason || 'Pagamento falhou na Hubla',
        externalReference: paymentData.externalReference
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    console.error('Erro ao atualizar status do pagamento falho:', err.message);
  }
}

async function handleSubscriptionCancelled(subscriptionData) {
  console.log('Assinatura cancelada:', subscriptionData.id);
  
  try {
    // Exemplo: Notificar um serviço interno
    await axios.post(
      process.env.INTERNAL_API_URL + '/update-subscription-status',
      {
        externalId: subscriptionData.id,
        status: 'CANCELLED',
        cancelledDate: subscriptionData.cancelledDate || new Date().toISOString(),
        externalReference: subscriptionData.externalReference
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    console.error('Erro ao atualizar status da assinatura cancelada:', err.message);
  }
}

async function handleSubscriptionRenewed(subscriptionData) {
  console.log('Assinatura renovada:', subscriptionData.id);
  
  try {
    // Exemplo: Notificar um serviço interno
    await axios.post(
      process.env.INTERNAL_API_URL + '/update-subscription-status',
      {
        externalId: subscriptionData.id,
        status: 'ACTIVE',
        nextDueDate: subscriptionData.nextDueDate,
        externalReference: subscriptionData.externalReference
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    console.error('Erro ao atualizar status da assinatura renovada:', err.message);
  }
}

// Função para enviar notificação de pagamento
async function sendPaymentNotification(customer, value, paidAt) {
  try {
    console.log(`Enviando notificação de pagamento para ${customer.name} (${customer.email})`);
    
    // Implementar lógica de envio de e-mail
    // Esta é uma função de exemplo que você deve adaptar para seu serviço de e-mail
    // Exemplo usando API interna de e-mail
    await axios.post(process.env.EMAIL_API_URL + '/send', {
      to: customer.email,
      subject: 'Pagamento confirmado',
      template: 'payment-confirmation',
      data: {
        name: customer.name,
        value: formatCurrency(value),
        date: formatDate(paidAt)
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`
      }
    });
    
    console.log(`Notificação de pagamento enviada com sucesso para ${customer.email}`);
  } catch (error) {
    console.error(`Erro ao enviar notificação de pagamento para ${customer.email}:`, error.message);
    throw error;
  }
}

// Função para enviar lembrete de pagamento
async function sendPaymentReminder(customer, value, dueDate) {
  try {
    console.log(`Enviando lembrete de pagamento para ${customer.name} (${customer.email})`);
    
    // Implementar lógica de envio de e-mail
    // Esta é uma função de exemplo que você deve adaptar para seu serviço de e-mail
    // Exemplo usando API interna de e-mail
    await axios.post(process.env.EMAIL_API_URL + '/send', {
      to: customer.email,
      subject: 'Lembrete de pagamento',
      template: 'payment-reminder',
      data: {
        name: customer.name,
        value: formatCurrency(value),
        dueDate: formatDate(dueDate)
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`
      }
    });
    
    console.log(`Lembrete de pagamento enviado com sucesso para ${customer.email}`);
  } catch (error) {
    console.error(`Erro ao enviar lembrete de pagamento para ${customer.email}:`, error.message);
    throw error;
  }
}

// Utilitário para formatar moeda
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Utilitário para formatar data
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
} 