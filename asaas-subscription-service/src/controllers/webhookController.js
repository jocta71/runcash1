const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { verifyWebhookSignature } = require('../config/asaas');

/**
 * Processa os webhooks enviados pelo Asaas
 */
exports.processWebhook = async (req, res) => {
  try {
    // Verificar a assinatura do webhook para garantir que é do Asaas
    if (!verifyWebhookSignature(req)) {
      console.error('Assinatura de webhook inválida');
      return res.status(401).json({
        success: false,
        message: 'Assinatura de webhook inválida'
      });
    }
    
    const event = req.body;
    console.log('Webhook recebido:', JSON.stringify(event));
    
    // Verificar o tipo de evento
    if (!event || !event.event) {
      return res.status(400).json({
        success: false,
        message: 'Formato de evento inválido'
      });
    }
    
    // Processar com base no tipo de evento
    switch (event.event) {
      case 'PAYMENT_RECEIVED':
        await handlePaymentReceived(event);
        break;
      case 'PAYMENT_CONFIRMED':
        await handlePaymentConfirmed(event);
        break;
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(event);
        break;
      case 'PAYMENT_REFUNDED':
        await handlePaymentRefunded(event);
        break;
      case 'PAYMENT_DELETED':
        await handlePaymentDeleted(event);
        break;
      case 'PAYMENT_UPDATED':
        await handlePaymentUpdated(event);
        break;
      case 'PAYMENT_CREATED':
        await handlePaymentCreated(event);
        break;
      case 'SUBSCRIPTION_ACTIVATED':
        await handleSubscriptionActivated(event);
        break;
      case 'SUBSCRIPTION_CANCELED':
        await handleSubscriptionCanceled(event);
        break;
      default:
        console.log(`Evento não tratado: ${event.event}`);
    }
    
    // Sempre responder com sucesso para que o Asaas não continue tentando enviar o webhook
    res.status(200).json({
      success: true,
      message: 'Webhook processado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    // Mesmo com erro, respondemos 200 para o Asaas não reenviar o mesmo webhook
    res.status(200).json({
      success: false,
      message: 'Erro ao processar webhook, mas recebido com sucesso'
    });
  }
};

// Manipuladores para cada tipo de evento

// Pagamento recebido
async function handlePaymentReceived(event) {
  try {
    const { payment } = event;
    
    // Verificar se o pagamento está associado a uma assinatura
    if (!payment.subscription) {
      console.log('Pagamento recebido não está associado a uma assinatura');
      return;
    }
    
    // Buscar a assinatura no banco de dados
    const subscription = await Subscription.findOne({
      asaasSubscriptionId: payment.subscription
    });
    
    if (!subscription) {
      console.error(`Assinatura não encontrada para o ID ${payment.subscription}`);
      return;
    }
    
    // Atualizar a assinatura
    subscription.status = 'active';
    subscription.lastPaymentDate = new Date();
    
    // Se tiver próxima data de pagamento no evento
    if (payment.nextDueDate) {
      subscription.nextDueDate = new Date(payment.nextDueDate);
    }
    
    await subscription.save();
    
    console.log(`Assinatura ${subscription._id} ativada após pagamento recebido`);
  } catch (error) {
    console.error('Erro ao processar pagamento recebido:', error);
  }
}

// Pagamento confirmado
async function handlePaymentConfirmed(event) {
  try {
    // Similar ao pagamento recebido
    await handlePaymentReceived(event);
  } catch (error) {
    console.error('Erro ao processar pagamento confirmado:', error);
  }
}

// Pagamento atrasado
async function handlePaymentOverdue(event) {
  try {
    const { payment } = event;
    
    // Verificar se o pagamento está associado a uma assinatura
    if (!payment.subscription) {
      console.log('Pagamento atrasado não está associado a uma assinatura');
      return;
    }
    
    // Buscar a assinatura no banco de dados
    const subscription = await Subscription.findOne({
      asaasSubscriptionId: payment.subscription
    });
    
    if (!subscription) {
      console.error(`Assinatura não encontrada para o ID ${payment.subscription}`);
      return;
    }
    
    // Atualizar a assinatura
    subscription.status = 'overdue';
    await subscription.save();
    
    console.log(`Assinatura ${subscription._id} marcada como atrasada`);
  } catch (error) {
    console.error('Erro ao processar pagamento atrasado:', error);
  }
}

// Pagamento reembolsado
async function handlePaymentRefunded(event) {
  try {
    const { payment } = event;
    
    // Verificar se o pagamento está associado a uma assinatura
    if (!payment.subscription) {
      console.log('Pagamento reembolsado não está associado a uma assinatura');
      return;
    }
    
    // Buscar a assinatura no banco de dados
    const subscription = await Subscription.findOne({
      asaasSubscriptionId: payment.subscription
    });
    
    if (!subscription) {
      console.error(`Assinatura não encontrada para o ID ${payment.subscription}`);
      return;
    }
    
    // Atualizar a assinatura
    subscription.status = 'inactive';
    await subscription.save();
    
    console.log(`Assinatura ${subscription._id} desativada após reembolso`);
  } catch (error) {
    console.error('Erro ao processar pagamento reembolsado:', error);
  }
}

// Pagamento excluído
async function handlePaymentDeleted(event) {
  // Normalmente não fazemos nada quando um pagamento é excluído
  console.log('Pagamento excluído:', event.payment.id);
}

// Pagamento atualizado
async function handlePaymentUpdated(event) {
  // Processar de acordo com o novo status do pagamento
  const { payment } = event;
  
  if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
    await handlePaymentReceived(event);
  } else if (payment.status === 'OVERDUE') {
    await handlePaymentOverdue(event);
  }
}

// Pagamento criado
async function handlePaymentCreated(event) {
  // Normalmente não fazemos nada quando um pagamento é criado
  console.log('Pagamento criado:', event.payment.id);
}

// Assinatura ativada
async function handleSubscriptionActivated(event) {
  try {
    const { subscription: subscriptionId } = event;
    
    // Buscar a assinatura no banco de dados
    const subscription = await Subscription.findOne({
      asaasSubscriptionId: subscriptionId
    });
    
    if (!subscription) {
      console.error(`Assinatura não encontrada para o ID ${subscriptionId}`);
      return;
    }
    
    // Atualizar a assinatura
    subscription.status = 'active';
    await subscription.save();
    
    console.log(`Assinatura ${subscription._id} ativada`);
  } catch (error) {
    console.error('Erro ao processar assinatura ativada:', error);
  }
}

// Assinatura cancelada
async function handleSubscriptionCanceled(event) {
  try {
    const { subscription: subscriptionId } = event;
    
    // Buscar a assinatura no banco de dados
    const subscription = await Subscription.findOne({
      asaasSubscriptionId: subscriptionId
    });
    
    if (!subscription) {
      console.error(`Assinatura não encontrada para o ID ${subscriptionId}`);
      return;
    }
    
    // Atualizar a assinatura
    subscription.status = 'canceled';
    await subscription.save();
    
    console.log(`Assinatura ${subscription._id} cancelada`);
  } catch (error) {
    console.error('Erro ao processar assinatura cancelada:', error);
  }
} 