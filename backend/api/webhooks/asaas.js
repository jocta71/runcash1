const express = require('express');
const router = express.Router();
const { User } = require('../../models/User');
const { Subscription } = require('../../models/Subscription');
const { Payment } = require('../../models/Payment');
const logger = require('../../utils/logger');

/**
 * Endpoint para receber webhooks do Asaas
 * Eventos suportados: CHECKOUT_PAID, PAYMENT_RECEIVED, SUBSCRIPTION_CREATED, etc
 */
router.post('/', async (req, res) => {
  try {
    const webhookData = req.body;
    logger.info(`Webhook recebido do Asaas: ${webhookData.event}`);
    
    // Verificar o tipo de evento recebido
    const event = webhookData.event;
    
    // Alguns eventos não têm payment, então fazemos essa verificação
    const paymentInfo = webhookData.payment || webhookData.data || {};
    const subscriptionInfo = webhookData.subscription || {};
    
    // ID do cliente no Asaas, usado para localizar o usuário
    const customerAsaasId = paymentInfo.customer || subscriptionInfo.customer;
    
    if (!customerAsaasId) {
      logger.warn('Webhook recebido sem ID de cliente, ignorando');
      return res.status(200).json({ success: true, message: 'Webhook recebido, mas sem ID de cliente' });
    }
    
    // Buscar o usuário baseado no ID do cliente do Asaas
    const user = await User.findOne({ asaasCustomerId: customerAsaasId });
    
    if (!user) {
      logger.warn(`Usuário não encontrado para o cliente Asaas ${customerAsaasId}`);
      return res.status(200).json({ success: true, message: 'Usuário não encontrado' });
    }
    
    // Processar eventos específicos
    switch (event) {
      case 'CHECKOUT_PAID':
        await processCheckoutPaid(user, paymentInfo, webhookData);
        break;
        
      case 'PAYMENT_RECEIVED':
        await processPaymentReceived(user, paymentInfo);
        break;
        
      case 'SUBSCRIPTION_CREATED':
        await processSubscriptionCreated(user, subscriptionInfo);
        break;
        
      case 'SUBSCRIPTION_RENEWED':
      case 'SUBSCRIPTION_UPDATED':
      case 'SUBSCRIPTION_PAYMENT_CONFIRMED':
        await processSubscriptionUpdate(user, subscriptionInfo);
        break;
        
      default:
        logger.info(`Evento não tratado: ${event}`);
    }
    
    return res.status(200).json({ success: true, message: 'Webhook processado com sucesso' });
  } catch (error) {
    logger.error(`Erro ao processar webhook: ${error.message}`);
    // Sempre retornar 200 para o Asaas, mesmo com erro, para evitar reenvios
    return res.status(200).json({ success: false, message: 'Erro ao processar webhook', error: error.message });
  }
});

/**
 * Processa o evento de pagamento de checkout
 */
async function processCheckoutPaid(user, paymentInfo, webhookData) {
  logger.info(`Processando CHECKOUT_PAID para usuário ${user._id}`);
  
  try {
    // Obter informações da assinatura que foi criada durante o checkout
    const subscriptionId = webhookData.subscription?.id || paymentInfo.subscription;
    
    if (!subscriptionId) {
      logger.warn('Checkout pago sem ID de assinatura, criando registro de pagamento apenas');
      await createPaymentRecord(user, paymentInfo);
      return;
    }
    
    // Verificar se já existe uma assinatura para o usuário
    let subscription = await Subscription.findOne({ userId: user._id });
    
    if (!subscription) {
      // Criar uma nova assinatura
      logger.info(`Criando nova assinatura para usuário ${user._id}`);
      subscription = new Subscription({
        userId: user._id,
        asaasSubscriptionId: subscriptionId,
        asaasCustomerId: user.asaasCustomerId,
        planType: 'pro', // Padrão, pode ser atualizado depois
        status: 'active',
        value: paymentInfo.value,
        nextDueDate: paymentInfo.dueDate || paymentInfo.nextDueDate,
        lastPaymentId: paymentInfo.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // Atualizar assinatura existente
      logger.info(`Atualizando assinatura existente para usuário ${user._id}`);
      subscription.asaasSubscriptionId = subscriptionId;
      subscription.status = 'active';
      subscription.lastPaymentId = paymentInfo.id;
      subscription.value = paymentInfo.value || subscription.value;
      subscription.nextDueDate = paymentInfo.dueDate || paymentInfo.nextDueDate || subscription.nextDueDate;
      subscription.updatedAt = new Date();
    }
    
    await subscription.save();
    logger.info(`Assinatura ${subscription._id} atualizada com sucesso após checkout`);
    
    // Também registrar o pagamento
    await createPaymentRecord(user, paymentInfo);
  } catch (error) {
    logger.error(`Erro ao processar CHECKOUT_PAID: ${error.message}`);
    throw error;
  }
}

/**
 * Processa o evento de pagamento recebido
 */
async function processPaymentReceived(user, paymentInfo) {
  logger.info(`Processando PAYMENT_RECEIVED para usuário ${user._id}`);
  
  try {
    // Verificar se este pagamento está associado a uma assinatura
    const subscriptionId = paymentInfo.subscription;
    
    if (subscriptionId) {
      // Atualizar a assinatura para ativa
      let subscription = await Subscription.findOne({ 
        $or: [{ userId: user._id }, { asaasSubscriptionId: subscriptionId }] 
      });
      
      if (subscription) {
        subscription.status = 'active';
        subscription.lastPaymentId = paymentInfo.id;
        subscription.value = paymentInfo.value || subscription.value;
        subscription.nextDueDate = paymentInfo.dueDate || subscription.nextDueDate;
        subscription.updatedAt = new Date();
        
        await subscription.save();
        logger.info(`Assinatura ${subscription._id} atualizada após pagamento`);
      } else {
        logger.warn(`Assinatura ${subscriptionId} não encontrada para pagamento ${paymentInfo.id}`);
      }
    }
    
    // Registrar o pagamento
    await createPaymentRecord(user, paymentInfo);
  } catch (error) {
    logger.error(`Erro ao processar PAYMENT_RECEIVED: ${error.message}`);
    throw error;
  }
}

/**
 * Processa o evento de assinatura criada
 */
async function processSubscriptionCreated(user, subscriptionInfo) {
  logger.info(`Processando SUBSCRIPTION_CREATED para usuário ${user._id}`);
  
  try {
    // Verificar se já existe uma assinatura para o usuário
    let subscription = await Subscription.findOne({ userId: user._id });
    
    if (!subscription) {
      // Criar uma nova assinatura
      subscription = new Subscription({
        userId: user._id,
        asaasSubscriptionId: subscriptionInfo.id,
        asaasCustomerId: user.asaasCustomerId,
        planType: subscriptionInfo.billingType || 'pro',
        status: subscriptionInfo.status === 'ACTIVE' ? 'active' : 'pending',
        value: subscriptionInfo.value,
        nextDueDate: subscriptionInfo.nextDueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // Atualizar assinatura existente
      subscription.asaasSubscriptionId = subscriptionInfo.id;
      subscription.status = subscriptionInfo.status === 'ACTIVE' ? 'active' : 'pending';
      subscription.value = subscriptionInfo.value || subscription.value;
      subscription.nextDueDate = subscriptionInfo.nextDueDate || subscription.nextDueDate;
      subscription.updatedAt = new Date();
    }
    
    await subscription.save();
    logger.info(`Assinatura ${subscription._id} criada/atualizada com sucesso`);
  } catch (error) {
    logger.error(`Erro ao processar SUBSCRIPTION_CREATED: ${error.message}`);
    throw error;
  }
}

/**
 * Processa eventos de atualização de assinatura
 */
async function processSubscriptionUpdate(user, subscriptionInfo) {
  logger.info(`Processando atualização de assinatura para usuário ${user._id}`);
  
  try {
    // Buscar a assinatura pelo ID no Asaas ou pelo usuário
    let subscription = await Subscription.findOne({ 
      $or: [
        { userId: user._id },
        { asaasSubscriptionId: subscriptionInfo.id }
      ] 
    });
    
    if (!subscription) {
      logger.warn(`Assinatura não encontrada para atualização: ${subscriptionInfo.id}`);
      // Criar uma nova assinatura
      subscription = new Subscription({
        userId: user._id,
        asaasSubscriptionId: subscriptionInfo.id,
        asaasCustomerId: user.asaasCustomerId,
        planType: 'pro',
        status: subscriptionInfo.status === 'ACTIVE' ? 'active' : 'pending',
        value: subscriptionInfo.value,
        nextDueDate: subscriptionInfo.nextDueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // Atualizar a assinatura
      subscription.status = subscriptionInfo.status === 'ACTIVE' ? 'active' : 'pending';
      subscription.value = subscriptionInfo.value || subscription.value;
      subscription.nextDueDate = subscriptionInfo.nextDueDate || subscription.nextDueDate;
      subscription.updatedAt = new Date();
    }
    
    await subscription.save();
    logger.info(`Assinatura ${subscription._id} atualizada com sucesso`);
  } catch (error) {
    logger.error(`Erro ao processar atualização de assinatura: ${error.message}`);
    throw error;
  }
}

/**
 * Cria um registro de pagamento
 */
async function createPaymentRecord(user, paymentInfo) {
  try {
    // Verificar se o pagamento já existe
    const existingPayment = await Payment.findOne({ 
      asaasPaymentId: paymentInfo.id 
    });
    
    if (existingPayment) {
      logger.info(`Pagamento ${paymentInfo.id} já registrado, atualizando`);
      existingPayment.status = paymentInfo.status;
      existingPayment.updatedAt = new Date();
      await existingPayment.save();
      return existingPayment;
    }
    
    // Criar um novo registro de pagamento
    const payment = new Payment({
      userId: user._id,
      asaasPaymentId: paymentInfo.id,
      asaasCustomerId: paymentInfo.customer,
      subscriptionId: paymentInfo.subscription,
      value: paymentInfo.value,
      netValue: paymentInfo.netValue,
      paymentDate: paymentInfo.paymentDate ? new Date(paymentInfo.paymentDate) : new Date(),
      status: paymentInfo.status,
      billingType: paymentInfo.billingType,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await payment.save();
    logger.info(`Pagamento ${payment._id} registrado com sucesso`);
    return payment;
  } catch (error) {
    logger.error(`Erro ao registrar pagamento: ${error.message}`);
    throw error;
  }
}

module.exports = router; 