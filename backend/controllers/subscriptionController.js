/**
 * Controller para gerenciar assinaturas via Asaas
 */

const axios = require('axios');
const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

// Configuração da API Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || 'seu_api_key';
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';

// Headers para requisições à API do Asaas
const asaasHeaders = {
  'Content-Type': 'application/json',
  'access_token': ASAAS_API_KEY
};

/**
 * Lista os planos disponíveis
 */
const listPlans = async (req, res) => {
  try {
    const db = await getDb();
    
    // Buscar planos do banco de dados
    const plans = await db.collection('subscription_plans').find({
      active: true
    }).toArray();
    
    return res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Erro ao listar planos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar planos disponíveis',
      error: error.message
    });
  }
};

/**
 * Cria uma nova assinatura no Asaas
 */
const createSubscription = async (req, res) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária'
      });
    }
    
    const db = await getDb();
    const { planId, customer, creditCard } = req.body;
    
    // Validar dados necessários
    if (!planId || !customer || !creditCard) {
      return res.status(400).json({
        success: false,
        message: 'Dados incompletos para criação da assinatura'
      });
    }
    
    // Buscar plano no banco de dados
    const plan = await db.collection('subscription_plans').findOne({
      _id: new ObjectId(planId)
    });
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plano não encontrado'
      });
    }
    
    // Verificar se já existe um cliente Asaas para o usuário
    let asaasCustomerId = null;
    const existingUser = await db.collection('users').findOne({
      _id: new ObjectId(req.user._id)
    });
    
    if (existingUser && existingUser.asaasCustomerId) {
      asaasCustomerId = existingUser.asaasCustomerId;
    } else {
      // Criar cliente no Asaas
      const customerData = {
        name: customer.name,
        email: customer.email,
        cpfCnpj: customer.cpfCnpj,
        mobilePhone: customer.phone
      };
      
      const customerResponse = await axios.post(
        `${ASAAS_API_URL}/customers`,
        customerData,
        { headers: asaasHeaders }
      );
      
      asaasCustomerId = customerResponse.data.id;
      
      // Atualizar usuário com ID do cliente Asaas
      await db.collection('users').updateOne(
        { _id: new ObjectId(req.user._id) },
        { $set: { asaasCustomerId } }
      );
    }
    
    // Criar assinatura no Asaas
    const subscriptionData = {
      customer: asaasCustomerId,
      billingType: 'CREDIT_CARD',
      nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Amanhã
      value: plan.price,
      cycle: plan.cycle || 'MONTHLY',
      description: `Assinatura - ${plan.name}`,
      creditCard: {
        holderName: creditCard.holderName,
        number: creditCard.number,
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv
      },
      creditCardHolderInfo: {
        name: creditCard.holderName,
        email: customer.email,
        cpfCnpj: customer.cpfCnpj,
        mobilePhone: customer.phone,
        postalCode: customer.postalCode,
        addressNumber: customer.addressNumber
      }
    };
    
    const asaasResponse = await axios.post(
      `${ASAAS_API_URL}/subscriptions`,
      subscriptionData,
      { headers: asaasHeaders }
    );
    
    // Registrar assinatura no banco
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    await db.collection('user_subscriptions').insertOne({
      userId: req.user._id.toString(),
      planId: planId,
      asaasSubscriptionId: asaasResponse.data.id,
      status: 'ACTIVE',
      createdAt: now,
      expiresAt: nextMonth,
      paymentInfo: {
        value: plan.price,
        cycle: plan.cycle || 'MONTHLY'
      }
    });
    
    return res.json({
      success: true,
      message: 'Assinatura criada com sucesso',
      data: {
        subscriptionId: asaasResponse.data.id,
        status: 'ACTIVE',
        nextDueDate: asaasResponse.data.nextDueDate
      }
    });
  } catch (error) {
    console.error('Erro ao criar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar assinatura',
      error: error.message
    });
  }
};

/**
 * Processa webhooks do Asaas
 */
const processWebhook = async (req, res) => {
  try {
    const body = req.body;
    const eventId = body.id;
    const db = await getDb();
    
    // Verificar se já processamos este evento (idempotência)
    const existingEvent = await db.collection('asaas_processed_webhooks').findOne({
      asaas_evt_id: eventId
    });
    
    if (existingEvent) {
      console.log(`Evento ${eventId} já processado anteriormente`);
      return res.json({ received: true });
    }
    
    // Registrar que estamos processando este evento
    await db.collection('asaas_processed_webhooks').insertOne({
      asaas_evt_id: eventId,
      timestamp: new Date()
    });
    
    const event = body.event;
    
    switch (event) {
      case 'PAYMENT_RECEIVED':
        // Pagamento recebido - atualizar assinatura
        const payment = body.payment;
        const subscriptionId = payment.subscription;
        
        if (subscriptionId) {
          // Buscar assinatura correspondente
          const subscription = await db.collection('user_subscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (subscription) {
            // Calcular nova data de expiração
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 1); // Adicionar 1 mês
            
            // Atualizar assinatura
            await db.collection('user_subscriptions').updateOne(
              { asaasSubscriptionId: subscriptionId },
              { 
                $set: {
                  status: 'ACTIVE',
                  expiresAt,
                  lastPaymentDate: new Date()
                }
              }
            );
            
            console.log(`Assinatura ${subscriptionId} atualizada após pagamento`);
          }
        }
        break;
        
      case 'PAYMENT_OVERDUE':
        // Pagamento atrasado
        const overduePayment = body.payment;
        const overdueSubscriptionId = overduePayment.subscription;
        
        if (overdueSubscriptionId) {
          await db.collection('user_subscriptions').updateOne(
            { asaasSubscriptionId: overdueSubscriptionId },
            { $set: { status: 'OVERDUE' } }
          );
        }
        break;
        
      case 'SUBSCRIPTION_CANCELLED':
        // Assinatura cancelada
        const cancelledSubscription = body.subscription;
        
        await db.collection('user_subscriptions').updateOne(
          { asaasSubscriptionId: cancelledSubscription.id },
          { $set: { status: 'CANCELLED' } }
        );
        break;
        
      default:
        console.log(`Evento não tratado: ${event}`);
    }
    
    // Retornar confirmação de recebimento
    return res.json({ received: true });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar webhook',
      error: error.message
    });
  }
};

/**
 * Verifica o status da assinatura do usuário atual
 */
const checkUserSubscription = async (req, res) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária'
      });
    }
    
    // Se o middleware de assinatura adicionou os dados, usar esses
    if (req.subscription) {
      return res.json({
        success: true,
        hasSubscription: true,
        subscription: {
          status: req.subscription.status,
          planId: req.subscription.planId,
          expiresAt: req.subscription.expiresAt
        }
      });
    }
    
    // Caso contrário, usuário não tem assinatura ativa
    return res.json({
      success: true,
      hasSubscription: false
    });
  } catch (error) {
    console.error('Erro ao verificar assinatura do usuário:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status da assinatura',
      error: error.message
    });
  }
};

module.exports = {
  listPlans,
  createSubscription,
  processWebhook,
  checkUserSubscription
}; 