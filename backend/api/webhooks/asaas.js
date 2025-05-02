const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { User } = require('../../models/User');
const { Subscription } = require('../../models/Subscription');
const { Payment } = require('../../models/Payment');
const { Checkout } = require('../../models/Checkout');
const { WebhookEvent } = require('../../models/WebhookEvent');
const logger = require('../../utils/logger');

// Lista de eventos suportados
const SUPPORTED_EVENTS = [
  'CHECKOUT_PAID',
  'PAYMENT_CREATED',
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_RENEWED',
  'SUBSCRIPTION_PAYMENT_CONFIRMED'
];

/**
 * Endpoint para receber webhooks do Asaas
 * Documentação: https://docs.asaas.com/docs/eventos-para-checkout
 */
router.post('/', async (req, res) => {
  try {
    const webhook = req.body;
    
    // Validar se o webhook contém os dados necessários
    if (!webhook || !webhook.event) {
      logger.warn('Webhook inválido recebido', { webhook });
      return res.status(200).json({ success: false, message: 'Webhook inválido' });
    }

    const event = webhook.event;
    logger.info(`Webhook recebido: ${event}`, { eventType: event });

    // Verificar se o evento é suportado
    if (!SUPPORTED_EVENTS.includes(event)) {
      logger.info(`Evento não suportado: ${event}`);
      return res.status(200).json({ success: true, message: 'Evento não suportado' });
    }

    // Extrair o customerId, é necessário para muitos processamentos
    const customerId = webhook.payment?.customer || 
                      webhook.subscription?.customer || 
                      webhook.checkout?.customer || 
                      null;

    // Gerar um ID único para o evento (para idempotência)
    const eventData = JSON.stringify(webhook);
    const eventId = crypto.createHash('md5').update(eventData).digest('hex');

    // Verificar se o evento já foi processado (idempotência)
    const existingEvent = await WebhookEvent.findOne({ eventId });
    if (existingEvent) {
      logger.info(`Evento já processado anteriormente: ${eventId}`, { eventId, event });
      return res.status(200).json({ 
        success: true, 
        message: 'Evento já processado', 
        status: existingEvent.status 
      });
    }

    // Armazenar os detalhes do evento para rastrear o processamento
    let webhookEventData = {
      eventId,
      event,
      sourceId: webhook.payment?.id || webhook.subscription?.id || webhook.checkout?.id,
      payload: webhook,
      status: 'PROCESSED'
    };

    let result = { success: false, message: 'Não processado' };

    // Processar o evento de acordo com seu tipo
    switch (event) {
      case 'CHECKOUT_PAID':
        result = await processCheckoutPaid(webhook, customerId);
        break;
      case 'PAYMENT_CREATED':
        result = await processPaymentCreated(webhook, customerId);
        break;
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        result = await processPaymentReceived(webhook, customerId);
        break;
      case 'SUBSCRIPTION_CREATED':
        result = await processSubscriptionCreated(webhook, customerId);
        break;
      case 'SUBSCRIPTION_UPDATED':
      case 'SUBSCRIPTION_RENEWED':
      case 'SUBSCRIPTION_PAYMENT_CONFIRMED':
        result = await processSubscriptionUpdate(webhook, customerId);
        break;
      default:
        webhookEventData.status = 'IGNORED';
        result = { success: true, message: 'Evento ignorado' };
    }

    // Se ocorreu erro no processamento, atualizar o status do evento
    if (!result.success) {
      webhookEventData.status = 'FAILED';
      webhookEventData.errorMessage = result.message || 'Erro não especificado';
    }

    // Registrar o evento no banco de dados
    await WebhookEvent.create(webhookEventData);
    
    // Sempre retornar 200 para o Asaas não reenviar o webhook
    return res.status(200).json(result);

  } catch (error) {
    logger.error('Erro ao processar webhook do Asaas', { error: error.message, stack: error.stack });
    
    try {
      // Tenta registrar o erro no banco de dados
      await WebhookEvent.create({
        eventId: crypto.randomBytes(16).toString('hex'),
        event: req.body?.event || 'UNKNOWN',
        sourceId: 'ERROR',
        payload: req.body || {},
        status: 'FAILED',
        errorMessage: error.message
      });
    } catch (dbError) {
      logger.error('Erro ao registrar falha de webhook', { error: dbError.message });
    }
    
    // Sempre retorna 200 para o Asaas não reenviar o webhook
    return res.status(200).json({ success: false, message: 'Erro interno' });
  }
});

/**
 * Processa um evento de checkout pago
 */
async function processCheckoutPaid(webhook, customerId) {
  try {
    const checkoutData = webhook.checkout;
    
    if (!checkoutData || !checkoutData.id) {
      return { success: false, message: 'Dados do checkout não encontrados' };
    }
    
    // Encontrar o usuário pelo customerId do Asaas
    const user = await User.findOne({ 'billingInfo.asaasId': customerId });
    
    if (!user) {
      logger.warn(`Usuário não encontrado para o customerId: ${customerId}`);
      return { success: false, message: 'Usuário não encontrado' };
    }

    // Verificar se o checkout já existe
    let checkout = await Checkout.findOne({ checkoutId: checkoutData.id });
    
    if (checkout) {
      // Atualizar o checkout existente
      checkout.status = 'PAID';
      checkout.paidAt = new Date();
      
      // Se tiver payment ou subscription, atualizar
      if (checkoutData.payment && checkoutData.payment.id) {
        checkout.paymentId = checkoutData.payment.id;
      }
      
      if (checkoutData.subscription && checkoutData.subscription.id) {
        checkout.subscriptionId = checkoutData.subscription.id;
      }
      
      await checkout.save();
      
      logger.info(`Checkout ${checkoutData.id} atualizado como pago`);
    } else {
      // Criar novo registro de checkout
      checkout = await Checkout.create({
        userId: user._id,
        checkoutId: checkoutData.id,
        paymentId: checkoutData.payment?.id,
        subscriptionId: checkoutData.subscription?.id,
        value: checkoutData.value,
        status: 'PAID',
        paidAt: new Date(),
        billingType: checkoutData.billingType || 'CREDIT_CARD',
        metadata: checkoutData
      });
      
      logger.info(`Novo checkout ${checkoutData.id} registrado`);
    }
    
    // Se tiver subscription, atualizar ou criar a assinatura
    if (checkoutData.subscription && checkoutData.subscription.id) {
      const subscriptionId = checkoutData.subscription.id;
      
      // Verificar se a assinatura já existe
      let subscription = await Subscription.findOne({ 
        userId: user._id, 
        asaasId: subscriptionId 
      });
      
      if (subscription) {
        // Atualizar a assinatura existente
        subscription.status = 'ACTIVE';
        subscription.updatedAt = new Date();
        await subscription.save();
        
        logger.info(`Assinatura ${subscriptionId} atualizada para ACTIVE`);
      } else {
        // Criar nova assinatura
        subscription = await Subscription.create({
          userId: user._id,
          asaasId: subscriptionId,
          planType: user.planType,
          status: 'ACTIVE',
          value: checkoutData.value,
          nextDueDate: checkoutData.subscription.nextDueDate,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // Atualizar o planType e planStatus do usuário
        user.planStatus = 'ACTIVE';
        await user.save();
        
        logger.info(`Nova assinatura ${subscriptionId} criada`);
      }
    }
    
    return { success: true, message: 'Checkout processado com sucesso' };
  } catch (error) {
    logger.error('Erro ao processar CHECKOUT_PAID', { error: error.message, stack: error.stack });
    return { success: false, message: `Erro ao processar checkout: ${error.message}` };
  }
}

/**
 * Processa um evento de pagamento criado
 * Este evento é crucial para correlacionar pagamentos com checkouts
 */
async function processPaymentCreated(webhook, customerId) {
  try {
    const paymentData = webhook.payment;
    
    if (!paymentData || !paymentData.id) {
      return { success: false, message: 'Dados do pagamento não encontrados' };
    }
    
    // Encontrar o usuário pelo customerId do Asaas
    const user = await User.findOne({ 'billingInfo.asaasId': customerId });
    
    if (!user) {
      logger.warn(`Usuário não encontrado para o customerId: ${customerId}`);
      return { success: false, message: 'Usuário não encontrado' };
    }

    // Verificar se o pagamento já existe
    let payment = await Payment.findOne({ paymentId: paymentData.id });
    
    if (!payment) {
      // Registrar o novo pagamento
      payment = await Payment.create({
        userId: user._id,
        paymentId: paymentData.id,
        value: paymentData.value,
        netValue: paymentData.netValue,
        status: paymentData.status,
        dueDate: paymentData.dueDate,
        billingType: paymentData.billingType,
        invoiceUrl: paymentData.invoiceUrl,
        subscriptionId: paymentData.subscription,
        metadata: paymentData
      });
      
      logger.info(`Novo pagamento ${paymentData.id} registrado`);
    } else {
      // Atualizar o pagamento existente
      payment.status = paymentData.status;
      payment.metadata = paymentData;
      await payment.save();
      
      logger.info(`Pagamento ${paymentData.id} atualizado`);
      return { success: true, message: 'Pagamento já registrado e atualizado' };
    }
    
    // Tentar associar este pagamento a um checkout recente
    // Buscar o checkout mais recente com o mesmo valor nos últimos 30 minutos
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const checkout = await Checkout.findOne({
      userId: user._id,
      value: paymentData.value,
      createdAt: { $gte: thirtyMinutesAgo },
      paymentId: { $exists: false }, // Ainda não tem pagamento associado
      status: 'PENDING'
    }).sort({ createdAt: -1 }); // O mais recente primeiro
    
    if (checkout) {
      // Associar o pagamento ao checkout
      checkout.paymentId = paymentData.id;
      await checkout.save();
      
      // Atualizar o pagamento com o ID do checkout
      payment.checkoutId = checkout.checkoutId;
      await payment.save();
      
      logger.info(`Pagamento ${paymentData.id} associado ao checkout ${checkout.checkoutId}`);
      
      // Se o checkout tem ID de assinatura, atualizar o pagamento
      if (checkout.subscriptionId) {
        payment.subscriptionId = checkout.subscriptionId;
        await payment.save();
        
        logger.info(`Pagamento ${paymentData.id} associado à assinatura ${checkout.subscriptionId}`);
      }
    } else {
      logger.info(`Não foi encontrado checkout pendente correspondente para o pagamento ${paymentData.id}`);
    }
    
    // Se o pagamento tem ID de assinatura, atualizar a assinatura
    if (paymentData.subscription) {
      const subscription = await Subscription.findOne({ 
        userId: user._id, 
        asaasId: paymentData.subscription 
      });
      
      if (subscription) {
        // Atualizar a data de próximo vencimento
        if (paymentData.dueDate) {
          subscription.nextDueDate = paymentData.dueDate;
          subscription.updatedAt = new Date();
          await subscription.save();
          
          logger.info(`Assinatura ${paymentData.subscription} atualizada com nova data de vencimento`);
        }
      }
    }
    
    return { success: true, message: 'Pagamento processado com sucesso' };
  } catch (error) {
    logger.error('Erro ao processar PAYMENT_CREATED', { error: error.message, stack: error.stack });
    return { success: false, message: `Erro ao processar pagamento: ${error.message}` };
  }
}

/**
 * Processa um evento de pagamento recebido ou confirmado
 */
async function processPaymentReceived(webhook, customerId) {
  try {
    const paymentData = webhook.payment;
    
    if (!paymentData || !paymentData.id) {
      return { success: false, message: 'Dados do pagamento não encontrados' };
    }
    
    // Encontrar o usuário pelo customerId do Asaas
    const user = await User.findOne({ 'billingInfo.asaasId': customerId });
    
    if (!user) {
      logger.warn(`Usuário não encontrado para o customerId: ${customerId}`);
      return { success: false, message: 'Usuário não encontrado' };
    }

    // Verificar se o pagamento já existe
    let payment = await Payment.findOne({ paymentId: paymentData.id });
    
    if (payment) {
      // Atualizar o pagamento existente
      payment.status = 'RECEIVED';
      payment.confirmedDate = new Date();
      payment.metadata = paymentData;
      await payment.save();
      
      logger.info(`Pagamento ${paymentData.id} atualizado como recebido`);
      
      // Se o pagamento estiver vinculado a um checkout, atualizar o checkout
      if (payment.checkoutId) {
        const checkout = await Checkout.findOne({ checkoutId: payment.checkoutId });
        
        if (checkout) {
          checkout.status = 'PAID';
          checkout.paidAt = new Date();
          await checkout.save();
          
          logger.info(`Checkout ${payment.checkoutId} atualizado como pago`);
        }
      }
      
      // Se o pagamento estiver vinculado a uma assinatura, atualizar a assinatura
      if (payment.subscriptionId) {
        const subscription = await Subscription.findOne({ 
          userId: user._id, 
          asaasId: payment.subscriptionId 
        });
        
        if (subscription) {
          subscription.status = 'ACTIVE';
          subscription.updatedAt = new Date();
          await subscription.save();
          
          // Atualizar o planStatus do usuário
          user.planStatus = 'ACTIVE';
          await user.save();
          
          logger.info(`Assinatura ${payment.subscriptionId} atualizada para ACTIVE`);
        }
      }
    } else {
      // Criar novo registro de pagamento
      payment = await Payment.create({
        userId: user._id,
        paymentId: paymentData.id,
        value: paymentData.value,
        netValue: paymentData.netValue,
        status: 'RECEIVED',
        confirmedDate: new Date(),
        dueDate: paymentData.dueDate,
        billingType: paymentData.billingType,
        invoiceUrl: paymentData.invoiceUrl,
        subscriptionId: paymentData.subscription,
        metadata: paymentData
      });
      
      logger.info(`Novo pagamento ${paymentData.id} registrado como recebido`);
      
      // Se o pagamento tem ID de assinatura, atualizar a assinatura
      if (paymentData.subscription) {
        const subscription = await Subscription.findOne({ 
          userId: user._id, 
          asaasId: paymentData.subscription 
        });
        
        if (subscription) {
          subscription.status = 'ACTIVE';
          subscription.updatedAt = new Date();
          await subscription.save();
          
          // Atualizar o planStatus do usuário
          user.planStatus = 'ACTIVE';
          await user.save();
          
          logger.info(`Assinatura ${paymentData.subscription} atualizada para ACTIVE`);
        }
      }
    }
    
    return { success: true, message: 'Pagamento recebido processado com sucesso' };
  } catch (error) {
    logger.error('Erro ao processar PAYMENT_RECEIVED', { error: error.message, stack: error.stack });
    return { success: false, message: `Erro ao processar pagamento recebido: ${error.message}` };
  }
}

/**
 * Processa um evento de assinatura criada
 */
async function processSubscriptionCreated(webhook, customerId) {
  try {
    const subscriptionData = webhook.subscription;
    
    if (!subscriptionData || !subscriptionData.id) {
      return { success: false, message: 'Dados da assinatura não encontrados' };
    }
    
    // Encontrar o usuário pelo customerId do Asaas
    const user = await User.findOne({ 'billingInfo.asaasId': customerId });
    
    if (!user) {
      logger.warn(`Usuário não encontrado para o customerId: ${customerId}`);
      return { success: false, message: 'Usuário não encontrado' };
    }

    // Verificar se a assinatura já existe
    let subscription = await Subscription.findOne({ 
      userId: user._id, 
      asaasId: subscriptionData.id 
    });
    
    if (subscription) {
      // Atualizar a assinatura existente
      subscription.status = subscriptionData.status;
      subscription.value = subscriptionData.value;
      subscription.nextDueDate = subscriptionData.nextDueDate;
      subscription.updatedAt = new Date();
      await subscription.save();
      
      logger.info(`Assinatura ${subscriptionData.id} atualizada`);
    } else {
      // Criar nova assinatura
      subscription = await Subscription.create({
        userId: user._id,
        asaasId: subscriptionData.id,
        planType: user.planType,
        status: subscriptionData.status,
        value: subscriptionData.value,
        nextDueDate: subscriptionData.nextDueDate,
        cycle: subscriptionData.cycle,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      logger.info(`Nova assinatura ${subscriptionData.id} criada`);
    }
    
    // Atualizar o planStatus do usuário se a assinatura estiver ativa
    if (subscriptionData.status === 'ACTIVE') {
      user.planStatus = 'ACTIVE';
      await user.save();
      
      logger.info(`Status do plano do usuário ${user._id} atualizado para ACTIVE`);
    }
    
    return { success: true, message: 'Assinatura criada processada com sucesso' };
  } catch (error) {
    logger.error('Erro ao processar SUBSCRIPTION_CREATED', { error: error.message, stack: error.stack });
    return { success: false, message: `Erro ao processar assinatura criada: ${error.message}` };
  }
}

/**
 * Processa um evento de atualização de assinatura
 */
async function processSubscriptionUpdate(webhook, customerId) {
  try {
    const subscriptionData = webhook.subscription;
    
    if (!subscriptionData || !subscriptionData.id) {
      return { success: false, message: 'Dados da assinatura não encontrados' };
    }
    
    // Encontrar o usuário pelo customerId do Asaas
    const user = await User.findOne({ 'billingInfo.asaasId': customerId });
    
    if (!user) {
      logger.warn(`Usuário não encontrado para o customerId: ${customerId}`);
      return { success: false, message: 'Usuário não encontrado' };
    }

    // Encontrar a assinatura
    const subscription = await Subscription.findOne({ 
      userId: user._id, 
      asaasId: subscriptionData.id 
    });
    
    if (!subscription) {
      logger.warn(`Assinatura ${subscriptionData.id} não encontrada para o usuário ${user._id}`);
      
      // Criar a assinatura se não existir (para recuperar de inconsistências)
      await Subscription.create({
        userId: user._id,
        asaasId: subscriptionData.id,
        planType: user.planType,
        status: subscriptionData.status,
        value: subscriptionData.value,
        nextDueDate: subscriptionData.nextDueDate,
        cycle: subscriptionData.cycle,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      logger.info(`Nova assinatura ${subscriptionData.id} criada durante atualização`);
    } else {
      // Atualizar a assinatura existente
      subscription.status = subscriptionData.status;
      subscription.value = subscriptionData.value;
      subscription.nextDueDate = subscriptionData.nextDueDate;
      subscription.updatedAt = new Date();
      await subscription.save();
      
      logger.info(`Assinatura ${subscriptionData.id} atualizada`);
    }
    
    // Atualizar o planStatus do usuário com base no status da assinatura
    if (subscriptionData.status === 'ACTIVE') {
      user.planStatus = 'ACTIVE';
      await user.save();
      
      logger.info(`Status do plano do usuário ${user._id} atualizado para ACTIVE`);
    } else if (subscriptionData.status === 'INACTIVE' || subscriptionData.status === 'OVERDUE') {
      user.planStatus = 'INACTIVE';
      await user.save();
      
      logger.info(`Status do plano do usuário ${user._id} atualizado para INACTIVE`);
    }
    
    return { success: true, message: 'Atualização de assinatura processada com sucesso' };
  } catch (error) {
    logger.error('Erro ao processar atualização de assinatura', { error: error.message, stack: error.stack });
    return { success: false, message: `Erro ao processar atualização de assinatura: ${error.message}` };
  }
}

module.exports = router; 