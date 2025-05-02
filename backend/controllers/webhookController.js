const { ObjectId } = require('mongodb');
const getDb = require('../services/database');
const asaasService = require('../services/asaasService');

/**
 * Processa webhooks do Asaas
 */
const handleAsaasWebhook = async (req, res) => {
  try {
    const body = req.body;
    const eventId = body.id;
    
    // Verificação básica de segurança
    const webhookToken = req.headers['asaas-webhook-token'];
    if (!webhookToken || webhookToken !== process.env.ASAAS_WEBHOOK_TOKEN) {
      console.warn('Tentativa de webhook com token inválido');
      return res.status(403).json({ received: false, error: 'Token inválido' });
    }
    
    // Verificar se o evento já foi processado (idempotência)
    const db = await getDb();
    const eventExists = await db.collection('asaas_events').findOne({ asaasEventId: eventId });
    
    if (eventExists) {
      console.log(`Evento ${eventId} já processado anteriormente`);
      return res.json({ received: true, status: 'already_processed' });
    }
    
    // Salvar o evento para garantir idempotência
    await db.collection('asaas_events').insertOne({
      asaasEventId: eventId,
      eventType: body.event,
      payload: body,
      processedAt: new Date()
    });
    
    console.log(`Processando evento ${body.event} (ID: ${eventId})`);
    
    // Processar evento baseado no tipo
    switch (body.event) {
      case 'PAYMENT_CREATED':
        // Apenas registra a criação do pagamento
        console.log(`Pagamento ${body.payment.id} criado para assinatura ${body.payment.subscription || 'N/A'}`);
        break;
        
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        // Atualizar status da assinatura para ativa
        if (body.payment && body.payment.subscription) {
          await updateSubscriptionStatus(body.payment.subscription, true, 
            body.payment.billingType === 'CREDIT_CARD' ? 'MONTHLY' : 'YEARLY');
          console.log(`Assinatura ${body.payment.subscription} ativada após pagamento confirmado`);
        }
        break;
        
      case 'PAYMENT_OVERDUE':
        // Notificar que o pagamento está atrasado, mas ainda não inativar
        if (body.payment && body.payment.subscription) {
          await updateSubscriptionStatus(body.payment.subscription, true, null, 'OVERDUE');
          console.log(`Assinatura ${body.payment.subscription} marcada como atrasada`);
        }
        break;
        
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
      case 'PAYMENT_CHARGEBACK_DISPUTE':
        // Inativar assinatura em caso de problemas graves
        if (body.payment && body.payment.subscription) {
          await updateSubscriptionStatus(body.payment.subscription, false);
          console.log(`Assinatura ${body.payment.subscription} desativada devido a evento ${body.event}`);
        }
        break;
        
      case 'SUBSCRIPTION_CREATED':
        // Registrar criação da assinatura (sem ativar ainda)
        if (body.subscription) {
          await registerSubscription(body.subscription);
          console.log(`Assinatura ${body.subscription.id} registrada, aguardando pagamento`);
        }
        break;
        
      case 'SUBSCRIPTION_ACTIVATED':
        // Ativar assinatura
        if (body.subscription) {
          await updateSubscriptionStatus(body.subscription.id, true, body.subscription.cycle);
          console.log(`Assinatura ${body.subscription.id} ativada`);
        }
        break;
        
      case 'SUBSCRIPTION_RENEWED':
        // Renovar assinatura
        if (body.subscription) {
          const expirationDays = body.subscription.cycle === 'YEARLY' ? 365 : 30;
          await updateSubscriptionExpiration(body.subscription.id, expirationDays);
          console.log(`Assinatura ${body.subscription.id} renovada por mais ${expirationDays} dias`);
        }
        break;
        
      case 'SUBSCRIPTION_CANCELED':
      case 'SUBSCRIPTION_ENDED':
      case 'SUBSCRIPTION_EXPIRED':
        // Inativar assinatura
        if (body.subscription) {
          await updateSubscriptionStatus(body.subscription.id, false);
          console.log(`Assinatura ${body.subscription.id} encerrada devido a evento ${body.event}`);
        }
        break;
        
      default:
        console.log(`Evento não tratado: ${body.event}`);
    }
    
    // Confirmar recebimento do webhook
    return res.json({ received: true, status: 'processed' });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({ received: false, error: 'Erro interno' });
  }
};

/**
 * Atualiza o status da assinatura para um usuário
 */
async function updateSubscriptionStatus(subscriptionId, isActive, cycle = null, status = null) {
  if (!subscriptionId) return;
  
  try {
    const db = await getDb();
    
    // Buscar usuário pela ID da assinatura no Asaas
    const user = await db.collection('users').findOne({
      'subscription.asaasSubscriptionId': subscriptionId
    });
    
    if (!user) {
      console.warn(`Nenhum usuário encontrado com assinatura ${subscriptionId}`);
      return;
    }
    
    // Calcular nova data de expiração
    let expiresAt = null;
    if (isActive) {
      const days = cycle === 'YEARLY' ? 365 : 30;
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    
    // Atualizar status da assinatura
    const updateData = { 
      'subscription.active': isActive
    };
    
    if (expiresAt) {
      updateData['subscription.expiresAt'] = expiresAt;
    }
    
    if (status) {
      updateData['subscription.status'] = status;
    }
    
    if (cycle) {
      // Determinar tipo de plano baseado no ciclo
      if (cycle === 'YEARLY') {
        updateData['subscription.planType'] = 'PREMIUM';
      } else {
        // Tentar obter o valor para determinar o tipo
        try {
          const subDetails = await asaasService.getSubscription(subscriptionId);
          updateData['subscription.planType'] = subDetails.value >= 40 ? 'PREMIUM' : 'BASIC';
        } catch (error) {
          // Caso não consiga determinar, assume BASIC
          updateData['subscription.planType'] = 'BASIC';
        }
      }
    }
    
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: updateData }
    );
    
    console.log(`Status de assinatura atualizado para ${user.email}: ${isActive ? 'ATIVO' : 'INATIVO'}`);
  } catch (error) {
    console.error('Erro ao atualizar status da assinatura:', error);
    throw error;
  }
}

/**
 * Atualiza a data de expiração da assinatura
 */
async function updateSubscriptionExpiration(subscriptionId, days = 30) {
  if (!subscriptionId) return;
  
  try {
    const db = await getDb();
    
    // Buscar usuário pela ID da assinatura no Asaas
    const user = await db.collection('users').findOne({
      'subscription.asaasSubscriptionId': subscriptionId
    });
    
    if (!user) {
      console.warn(`Nenhum usuário encontrado com assinatura ${subscriptionId}`);
      return;
    }
    
    // Calcular nova data de expiração
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    
    // Atualizar data de expiração
    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: {
          'subscription.active': true,
          'subscription.expiresAt': expiresAt,
          'subscription.status': 'ACTIVE'
        }
      }
    );
    
    console.log(`Data de expiração atualizada para ${user.email}: ${expiresAt.toISOString()}`);
  } catch (error) {
    console.error('Erro ao atualizar data de expiração:', error);
    throw error;
  }
}

/**
 * Registra uma nova assinatura para um usuário
 */
async function registerSubscription(subscription) {
  if (!subscription || !subscription.customer) return;
  
  try {
    const db = await getDb();
    
    // Buscar usuário pelo ID do cliente no Asaas
    const user = await db.collection('users').findOne({
      asaasCustomerId: subscription.customer
    });
    
    if (!user) {
      console.warn(`Nenhum usuário encontrado com ID de cliente ${subscription.customer}`);
      return;
    }
    
    // Registrar ID da assinatura para o usuário
    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: {
          'subscription.asaasSubscriptionId': subscription.id,
          'subscription.status': subscription.status || 'PENDING',
          'subscription.active': subscription.status === 'ACTIVE'
        }
      }
    );
    
    console.log(`Assinatura ${subscription.id} registrada para ${user.email}`);
  } catch (error) {
    console.error('Erro ao registrar assinatura:', error);
    throw error;
  }
}

module.exports = {
  handleAsaasWebhook
}; 