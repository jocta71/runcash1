const express = require('express');
const router = express.Router();
const Webhook = require('../models/webhook.model');
const Subscription = require('../models/subscription.model');
const User = require('../models/user.model');
const ApiAccess = require('../models/apiAccess.model');
const asaasService = require('../services/asaas.service');

/**
 * @route   POST /api/asaas/webhook
 * @desc    Recebe notificações da Asaas via webhook
 * @access  Public
 */
router.post('/webhook', async (req, res) => {
  try {
    // Verificar token de segurança se existir
    const webhookToken = req.query.token || req.headers['x-webhook-token'];
    if (process.env.ASAAS_WEBHOOK_TOKEN && webhookToken !== process.env.ASAAS_WEBHOOK_TOKEN) {
      console.warn('[Webhook] Token inválido:', webhookToken);
      return res.status(401).json({ message: 'Token inválido' });
    }
    
    // Extrair dados do webhook
    const { event, payment } = req.body;
    console.log(`[Webhook] Evento recebido: ${event}`);
    
    // Salvar o webhook no banco para auditoria
    const webhook = new Webhook({
      event,
      payload: req.body,
      asaasId: payment?.id,
      customerId: payment?.customer,
      subscriptionId: payment?.subscription
    });
    
    await webhook.save();
    
    // Processar o webhook de acordo com o evento
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      await processPaymentConfirmed(payment, webhook);
    } else if (event === 'PAYMENT_OVERDUE') {
      await processPaymentOverdue(payment, webhook);
    } else if (event === 'SUBSCRIPTION_CANCELED') {
      await processSubscriptionCanceled(payment, webhook);
    }
    
    return res.status(200).json({ message: 'Webhook recebido com sucesso' });
  } catch (error) {
    console.error('[Webhook] Erro ao processar webhook:', error);
    return res.status(500).json({ message: 'Erro ao processar webhook', error: error.message });
  }
});

/**
 * Processa um pagamento confirmado
 * @param {Object} payment - Dados do pagamento
 * @param {Object} webhook - Registro do webhook
 */
async function processPaymentConfirmed(payment, webhook) {
  try {
    // Verificar se o pagamento está relacionado a uma assinatura
    if (!payment.subscription) {
      console.log('[Webhook] Pagamento não relacionado a uma assinatura:', payment.id);
      return;
    }
    
    // Buscar a assinatura no banco de dados
    const subscription = await Subscription.findOne({ asaasSubscriptionId: payment.subscription });
    
    if (!subscription) {
      console.log('[Webhook] Assinatura não encontrada:', payment.subscription);
      
      // Buscar dados da assinatura na Asaas
      const asaasSubscription = await asaasService.getSubscription(payment.subscription);
      
      if (asaasSubscription) {
        // Buscar usuário pelo ID do cliente na Asaas
        const user = await User.findOne({ asaasCustomerId: asaasSubscription.customer });
        
        if (user) {
          // Criar a assinatura no banco de dados
          const newSubscription = new Subscription({
            userId: user._id,
            asaasCustomerId: asaasSubscription.customer,
            asaasSubscriptionId: asaasSubscription.id,
            status: 'ACTIVE',
            value: asaasSubscription.value,
            nextDueDate: asaasSubscription.nextDueDate,
            billingType: asaasSubscription.billingType,
            description: asaasSubscription.description,
            cycle: asaasSubscription.cycle
          });
          
          await newSubscription.save();
          
          // Atualizar ApiAccess para dar permissão ao usuário
          let apiAccess = await ApiAccess.findOne({ userId: user._id });
          
          if (!apiAccess) {
            apiAccess = new ApiAccess({
              userId: user._id,
              externalId: user.externalId,
              subscriptionId: newSubscription._id,
              asaasSubscriptionId: newSubscription.asaasSubscriptionId,
              isActive: true,
              plan: 'PREMIUM',
              endpoints: [
                {
                  path: '/api/roulettes',
                  methods: ['GET', 'POST', 'PUT', 'DELETE'],
                  isAllowed: true
                }
              ],
              startDate: new Date(),
              endDate: null // Assinatura ativa até ser cancelada
            });
          } else {
            apiAccess.isActive = true;
            apiAccess.plan = 'PREMIUM';
            apiAccess.subscriptionId = newSubscription._id;
            apiAccess.asaasSubscriptionId = newSubscription.asaasSubscriptionId;
            apiAccess.endpoints = [
              {
                path: '/api/roulettes',
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
                isAllowed: true
              }
            ];
            apiAccess.startDate = new Date();
            apiAccess.endDate = null;
          }
          
          await apiAccess.save();
          
          // Atualizar o webhook
          webhook.userId = user._id;
          webhook.actionTaken = 'SUBSCRIPTION_ACTIVATED';
          webhook.processed = true;
          webhook.processedAt = new Date();
          await webhook.save();
          
          console.log(`[Webhook] Acesso à API ativado para usuário: ${user.email}`);
        }
      }
    } else {
      // Atualizar a assinatura existente
      subscription.status = 'ACTIVE';
      subscription.nextDueDate = payment.dueDate;
      
      // Adicionar pagamento ao histórico
      subscription.recentPayments.unshift({
        id: payment.id,
        value: payment.value,
        status: payment.status,
        billingType: payment.billingType,
        paymentDate: payment.paymentDate,
        invoiceUrl: payment.invoiceUrl,
        createdAt: new Date()
      });
      
      // Limitar o histórico a 10 pagamentos
      if (subscription.recentPayments.length > 10) {
        subscription.recentPayments = subscription.recentPayments.slice(0, 10);
      }
      
      await subscription.save();
      
      // Atualizar ApiAccess para garantir acesso
      const apiAccess = await ApiAccess.findOne({ 
        userId: subscription.userId,
        subscriptionId: subscription._id
      });
      
      if (apiAccess) {
        apiAccess.isActive = true;
        apiAccess.endDate = null; // Acesso sem data de expiração para assinantes ativos
        await apiAccess.save();
      }
      
      // Atualizar o webhook
      webhook.userId = subscription.userId;
      webhook.actionTaken = 'PAYMENT_CONFIRMED';
      webhook.processed = true;
      webhook.processedAt = new Date();
      await webhook.save();
      
      console.log(`[Webhook] Assinatura ${subscription.asaasSubscriptionId} ativada com sucesso`);
    }
  } catch (error) {
    console.error('[Webhook] Erro ao processar pagamento confirmado:', error);
    webhook.processingErrors.push({
      message: error.message,
      stack: error.stack,
      date: new Date()
    });
    await webhook.save();
  }
}

/**
 * Processa um pagamento em atraso
 * @param {Object} payment - Dados do pagamento
 * @param {Object} webhook - Registro do webhook
 */
async function processPaymentOverdue(payment, webhook) {
  try {
    // Verificar se o pagamento está relacionado a uma assinatura
    if (!payment.subscription) {
      console.log('[Webhook] Pagamento não relacionado a uma assinatura:', payment.id);
      return;
    }
    
    // Buscar a assinatura no banco de dados
    const subscription = await Subscription.findOne({ asaasSubscriptionId: payment.subscription });
    
    if (!subscription) {
      console.log('[Webhook] Assinatura não encontrada:', payment.subscription);
      return;
    }
    
    // Atualizar a assinatura
    subscription.status = 'OVERDUE';
    
    // Adicionar pagamento ao histórico (se não existir)
    const paymentExists = subscription.recentPayments.some(p => p.id === payment.id);
    
    if (!paymentExists) {
      subscription.recentPayments.unshift({
        id: payment.id,
        value: payment.value,
        status: payment.status,
        billingType: payment.billingType,
        paymentDate: null,
        invoiceUrl: payment.invoiceUrl,
        createdAt: new Date()
      });
      
      // Limitar o histórico a 10 pagamentos
      if (subscription.recentPayments.length > 10) {
        subscription.recentPayments = subscription.recentPayments.slice(0, 10);
      }
    }
    
    await subscription.save();
    
    // Atualizar ApiAccess para suspender acesso
    const apiAccess = await ApiAccess.findOne({ 
      userId: subscription.userId,
      subscriptionId: subscription._id
    });
    
    if (apiAccess) {
      apiAccess.isActive = false;
      
      // Manter o plano, mas adicionar dias de carência (7 dias)
      const gracePeriod = new Date();
      gracePeriod.setDate(gracePeriod.getDate() + 7);
      apiAccess.endDate = gracePeriod;
      
      await apiAccess.save();
    }
    
    // Atualizar o webhook
    webhook.userId = subscription.userId;
    webhook.actionTaken = 'PAYMENT_OVERDUE';
    webhook.processed = true;
    webhook.processedAt = new Date();
    await webhook.save();
    
    console.log(`[Webhook] Assinatura ${subscription.asaasSubscriptionId} marcada como atrasada`);
  } catch (error) {
    console.error('[Webhook] Erro ao processar pagamento em atraso:', error);
    webhook.processingErrors.push({
      message: error.message,
      stack: error.stack,
      date: new Date()
    });
    await webhook.save();
  }
}

/**
 * Processa um cancelamento de assinatura
 * @param {Object} payment - Dados do pagamento/assinatura
 * @param {Object} webhook - Registro do webhook
 */
async function processSubscriptionCanceled(data, webhook) {
  try {
    // Obter ID da assinatura do webhook
    const subscriptionId = data?.subscription || data?.id;
    
    if (!subscriptionId) {
      console.log('[Webhook] ID da assinatura não encontrado no webhook');
      return;
    }
    
    // Buscar a assinatura no banco de dados
    const subscription = await Subscription.findOne({ asaasSubscriptionId: subscriptionId });
    
    if (!subscription) {
      console.log('[Webhook] Assinatura não encontrada:', subscriptionId);
      return;
    }
    
    // Atualizar a assinatura
    subscription.status = 'CANCELED';
    await subscription.save();
    
    // Atualizar ApiAccess para remover acesso
    const apiAccess = await ApiAccess.findOne({ 
      userId: subscription.userId,
      subscriptionId: subscription._id
    });
    
    if (apiAccess) {
      apiAccess.isActive = false;
      apiAccess.plan = 'FREE';
      apiAccess.endpoints = [
        {
          path: '/api/roulettes',
          methods: ['GET', 'POST', 'PUT', 'DELETE'],
          isAllowed: false
        }
      ];
      apiAccess.endDate = new Date(); // Acesso termina imediatamente
      
      await apiAccess.save();
    }
    
    // Atualizar o webhook
    webhook.userId = subscription.userId;
    webhook.actionTaken = 'SUBSCRIPTION_CANCELED';
    webhook.processed = true;
    webhook.processedAt = new Date();
    await webhook.save();
    
    console.log(`[Webhook] Assinatura ${subscription.asaasSubscriptionId} cancelada com sucesso`);
  } catch (error) {
    console.error('[Webhook] Erro ao processar cancelamento de assinatura:', error);
    webhook.processingErrors.push({
      message: error.message,
      stack: error.stack,
      date: new Date()
    });
    await webhook.save();
  }
}

module.exports = router; 