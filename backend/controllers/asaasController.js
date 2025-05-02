/**
 * Controlador para integrações com o Asaas
 */

const asaasService = require('../services/asaasService');
const getDb = require('../services/database');
const asaasProcessedWebhooks = require('../models/asaasProcessedWebhooks');

// Mapeamento de planos com valores e IDs
const PLANS = {
  mensal: {
    name: 'Plano Mensal',
    value: 29.90,
    billingType: 'MONTHLY',
    description: 'Acesso a recursos premium por 1 mês',
    daysUntilDue: 5,
    externalReference: 'MENSAL'
  },
  trimestral: {
    name: 'Plano Trimestral',
    value: 79.90,
    billingType: 'QUARTERLY',
    description: 'Acesso a recursos premium por 3 meses',
    daysUntilDue: 5,
    externalReference: 'TRIMESTRAL'
  },
  anual: {
    name: 'Plano Anual',
    value: 299.90,
    billingType: 'YEARLY',
    description: 'Acesso a recursos premium por 12 meses',
    daysUntilDue: 5,
    externalReference: 'ANUAL'
  }
};

/**
 * Criar um checkout para assinatura com o Asaas
 */
exports.createCheckout = async (req, res) => {
  try {
    const { planoId } = req.body;
    
    // Verificar se o plano existe
    if (!planoId || !PLANS[planoId]) {
      return res.status(400).json({
        success: false,
        message: 'Plano inválido',
        error: 'INVALID_PLAN'
      });
    }
    
    // Obter dados do plano
    const planConfig = PLANS[planoId];
    
    // Verificar se o usuário tem um customerId no Asaas
    let customerId = req.usuario.asaasCustomerId;
    
    if (!customerId) {
      // Criar cliente no Asaas
      const customerResult = await asaasService.createOrGetCustomer({
        name: req.usuario.nome || req.usuario.username,
        email: req.usuario.email,
        externalReference: req.usuario.id
      });
      
      if (!customerResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Falha ao criar cliente no Asaas',
          error: customerResult.error
        });
      }
      
      customerId = customerResult.customerId;
      
      // Atualizar o ID do cliente no banco de dados
      const db = await getDb();
      await db.collection('usuarios').updateOne(
        { _id: req.usuario.id },
        { $set: { asaasCustomerId: customerId }}
      );
    }
    
    // Criar assinatura no Asaas
    const checkoutData = {
      customer: customerId,
      billingType: planConfig.billingType,
      value: planConfig.value,
      nextDueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 dias a partir de hoje
      description: planConfig.description,
      externalReference: planConfig.externalReference,
      autoRenew: true
    };
    
    // Chamar API do Asaas para criar assinatura e checkout
    const checkoutResult = await asaasService.createSubscriptionCheckout(checkoutData);
    
    if (!checkoutResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Falha ao criar checkout',
        error: checkoutResult.error
      });
    }
    
    // Retornar URL de checkout
    return res.json({
      success: true,
      message: 'Checkout criado com sucesso',
      checkoutUrl: checkoutResult.checkoutUrl,
      subscriptionId: checkoutResult.subscriptionId
    });
    
  } catch (error) {
    console.error('Erro ao criar checkout:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar checkout',
      error: error.message
    });
  }
};

/**
 * Webhook para receber notificações de pagamento do Asaas
 */
exports.handleWebhook = async (req, res) => {
  try {
    const { event, subscription } = req.body;
    
    // Verificar se o corpo do webhook contém as informações necessárias
    if (!event || !subscription || !subscription.id) {
      return res.status(400).json({
        success: false,
        message: 'Dados do webhook incompletos',
        error: 'INVALID_WEBHOOK_DATA'
      });
    }
    
    console.log(`[AsaasWebhook] Evento recebido: ${event} para assinatura ${subscription.id}`);
    
    // Verificar idempotência - se este evento já foi processado
    const eventId = req.body.id;
    const isProcessed = await asaasProcessedWebhooks.isEventProcessed(eventId);
    
    if (isProcessed) {
      console.log(`[AsaasWebhook] Evento ${eventId} já foi processado anteriormente.`);
      return res.json({ success: true, received: true, alreadyProcessed: true });
    }
    
    const db = await getDb();
    
    // Processar eventos específicos
    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        // Atualizar status da assinatura para ativa
        await db.collection('usuarios').updateOne(
          { asaasCustomerId: subscription.customer },
          { 
            $set: { 
              'subscription.active': true,
              'subscription.status': 'ACTIVE',
              'subscription.planId': subscription.externalReference,
              'subscription.updatedAt': new Date()
            } 
          }
        );
        break;
        
      case 'PAYMENT_OVERDUE':
        // Atualizar status da assinatura para atrasada
        await db.collection('usuarios').updateOne(
          { asaasCustomerId: subscription.customer },
          { 
            $set: { 
              'subscription.active': false,
              'subscription.status': 'OVERDUE',
              'subscription.updatedAt': new Date()
            } 
          }
        );
        break;
        
      case 'SUBSCRIPTION_CANCELLED':
        // Atualizar status da assinatura para cancelada
        await db.collection('usuarios').updateOne(
          { asaasCustomerId: subscription.customer },
          { 
            $set: { 
              'subscription.active': false,
              'subscription.status': 'CANCELLED',
              'subscription.updatedAt': new Date()
            } 
          }
        );
        break;
        
      default:
        console.log(`[AsaasWebhook] Evento não processado: ${event}`);
    }
    
    // Registrar evento como processado
    await asaasProcessedWebhooks.registerProcessedEvent(req.body);
    
    // Retornar confirmação de recebimento
    return res.json({ success: true, received: true });
    
  } catch (error) {
    console.error('Erro ao processar webhook do Asaas:', error);
    
    // Mesmo em caso de erro, retornar 200 para evitar reenvios do Asaas
    return res.status(200).json({
      success: false,
      message: 'Erro ao processar webhook',
      error: error.message
    });
  }
};

/**
 * Verificar status da assinatura do usuário
 */
exports.checkSubscriptionStatus = async (req, res) => {
  try {
    // Verificar se o usuário tem um customerID no Asaas
    if (!req.usuario.asaasCustomerId) {
      return res.json({
        success: true,
        data: {
          possuiAssinatura: false,
          status: 'sem assinatura'
        }
      });
    }
    
    // Consultar status de assinatura via API Asaas
    const subscriptionStatus = await asaasService.checkSubscriptionStatus(req.usuario.asaasCustomerId);
    
    if (!subscriptionStatus.success) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar status da assinatura',
        error: subscriptionStatus.error
      });
    }
    
    // Verificar se o usuário tem assinatura ativa
    if (!subscriptionStatus.hasActiveSubscription) {
      return res.json({
        success: true,
        data: {
          possuiAssinatura: false,
          status: subscriptionStatus.status || 'inativa'
        }
      });
    }
    
    // Mapear o tipo de plano
    let planoNome;
    switch (subscriptionStatus.subscription.externalReference) {
      case 'MENSAL':
        planoNome = 'mensal';
        break;
      case 'TRIMESTRAL':
        planoNome = 'trimestral';
        break;
      case 'ANUAL':
        planoNome = 'anual';
        break;
      default:
        planoNome = 'desconhecido';
    }
    
    // Retornar detalhes da assinatura
    return res.json({
      success: true,
      data: {
        possuiAssinatura: true,
        status: subscriptionStatus.status,
        plano: planoNome,
        dataInicio: subscriptionStatus.subscription.dateCreated,
        validade: subscriptionStatus.subscription.nextDueDate
      }
    });
    
  } catch (error) {
    console.error('Erro ao verificar status da assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao verificar assinatura',
      error: error.message
    });
  }
}; 