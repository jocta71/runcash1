/**
 * Controller para gerenciar assinaturas via Asaas
 */

const axios = require('axios');
const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

// Configuração do Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
// O token de webhook é configurado pelo usuário na interface do Asaas

// Planos disponíveis
const PLANS = {
  BASIC: {
    id: 'basic_plan',
    name: 'Plano Básico',
    description: 'Acesso a 15 roletas',
    price: 29.90,
    billingCycle: 'MONTHLY'
  },
  PRO: {
    id: 'pro_plan',
    name: 'Plano Profissional',
    description: 'Acesso a todas as roletas com histórico estendido',
    price: 49.90,
    billingCycle: 'MONTHLY'
  },
  PREMIUM: {
    id: 'premium_plan',
    name: 'Plano Premium',
    description: 'Todas as funcionalidades com prioridade de acesso',
    price: 99.90,
    billingCycle: 'MONTHLY'
  }
};

/**
 * Configura a instância do Axios para o Asaas
 */
const asaasAPI = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY
  }
});

/**
 * Lista todos os planos disponíveis
 */
const listPlans = async (req, res) => {
  try {
    // Verificar se o usuário já tem alguma assinatura
    let currentPlan = null;
    
    if (req.user && req.user._id) {
      const db = await getDb();
      const subscription = await db.collection('subscriptions').findOne({
        userId: ObjectId.isValid(req.user._id) ? new ObjectId(req.user._id) : req.user._id,
        status: 'ACTIVE'
      });
      
      if (subscription) {
        currentPlan = {
          type: subscription.planType,
          status: subscription.status,
          expiryDate: subscription.expiryDate
        };
      }
    }
    
    return res.json({
      success: true,
      data: {
        plans: Object.values(PLANS),
        currentPlan
      }
    });
  } catch (error) {
    console.error('Erro ao listar planos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter planos disponíveis',
      error: error.message
    });
  }
};

/**
 * Cria um checkout para um plano específico
 */
const createCheckout = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    const { planId } = req.body;
    
    // Verificar se o plano existe
    const planKey = Object.keys(PLANS).find(key => PLANS[key].id === planId);
    if (!planKey) {
      return res.status(400).json({
        success: false,
        message: 'Plano inválido ou inexistente'
      });
    }
    
    const plan = PLANS[planKey];
    const db = await getDb();
    
    // Verificar se o usuário já existe no Asaas
    let asaasCustomerId;
    const existingCustomer = await db.collection('users').findOne({
      _id: ObjectId.isValid(req.user._id) ? new ObjectId(req.user._id) : req.user._id
    });
    
    if (existingCustomer && existingCustomer.asaasCustomerId) {
      asaasCustomerId = existingCustomer.asaasCustomerId;
    } else {
      // Criar um cliente no Asaas
      const customerResponse = await asaasAPI.post('/customers', {
        name: existingCustomer.name || 'Cliente RunCash',
        email: existingCustomer.email,
        phone: existingCustomer.phone || '',
        mobilePhone: existingCustomer.mobilePhone || '',
        cpfCnpj: existingCustomer.cpfCnpj || '',
        postalCode: existingCustomer.postalCode || '',
        address: existingCustomer.address || '',
        addressNumber: existingCustomer.addressNumber || '',
        complement: existingCustomer.complement || '',
        province: existingCustomer.province || '',
        externalReference: req.user._id.toString()
      });
      
      asaasCustomerId = customerResponse.data.id;
      
      // Atualizar usuário com ID do Asaas
      await db.collection('users').updateOne(
        { _id: ObjectId.isValid(req.user._id) ? new ObjectId(req.user._id) : req.user._id },
        { $set: { asaasCustomerId } }
      );
    }
    
    // Criar uma assinatura no Asaas
    const subscriptionData = {
      customer: asaasCustomerId,
      billingType: 'CREDIT_CARD', // Ou outra forma de pagamento
      value: plan.price,
      nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Amanhã
      cycle: plan.billingCycle,
      description: `Assinatura ${plan.name}`,
      externalReference: `${req.user._id.toString()}_${planId}`
    };
    
    const asaasSubscription = await asaasAPI.post('/subscriptions', subscriptionData);
    
    // Salvar informações da assinatura no MongoDB
    await db.collection('subscriptions').insertOne({
      userId: ObjectId.isValid(req.user._id) ? new ObjectId(req.user._id) : req.user._id,
      asaasCustomerId,
      asaasSubscriptionId: asaasSubscription.data.id,
      planType: planKey,
      status: 'PENDING', // Será atualizado pelo webhook quando o pagamento for confirmado
      startDate: new Date(),
      expiryDate: null, // Será definido quando o pagamento for confirmado
      paymentHistory: [],
      createdAt: new Date()
    });
    
    // Criar URL de checkout
    let checkoutUrl;
    if (asaasSubscription.data.id) {
      // No caso real, você usaria a API do Asaas para gerar o link de pagamento
      checkoutUrl = `${ASAAS_API_URL}/payments/${asaasSubscription.data.id}/identificationField`;
    }
    
    return res.json({
      success: true,
      data: {
        checkoutUrl,
        subscriptionId: asaasSubscription.data.id,
        plan: plan.name
      }
    });
  } catch (error) {
    console.error('Erro ao criar checkout:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar solicitação de assinatura',
      error: error.message
    });
  }
};

/**
 * Verifica o status atual da assinatura do usuário
 */
const checkSubscriptionStatus = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    const db = await getDb();
    const subscription = await db.collection('subscriptions').findOne({
      userId: ObjectId.isValid(req.user._id) ? new ObjectId(req.user._id) : req.user._id
    }, {
      sort: { createdAt: -1 } // Pegar a assinatura mais recente
    });
    
    if (!subscription) {
      return res.json({
        success: true,
        data: {
          hasSubscription: false,
          message: 'Usuário não possui assinatura'
        }
      });
    }
    
    // Verificar status da assinatura no Asaas
    try {
      const asaasResponse = await asaasAPI.get(`/subscriptions/${subscription.asaasSubscriptionId}`);
      
      // Atualizar status local se necessário
      if (asaasResponse.data && asaasResponse.data.status !== subscription.status) {
        await db.collection('subscriptions').updateOne(
          { _id: subscription._id },
          { $set: { status: asaasResponse.data.status } }
        );
        
        subscription.status = asaasResponse.data.status;
      }
    } catch (asaasError) {
      console.error('Erro ao verificar assinatura no Asaas:', asaasError);
      // Continuar com os dados locais em caso de erro
    }
    
    // Verificar se a assinatura está ativa
    const isActive = subscription.status === 'ACTIVE';
    
    return res.json({
      success: true,
      data: {
        hasSubscription: isActive,
        subscription: {
          planType: subscription.planType,
          status: subscription.status,
          startDate: subscription.startDate,
          expiryDate: subscription.expiryDate
        }
      }
    });
  } catch (error) {
    console.error('Erro ao verificar status da assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status da assinatura',
      error: error.message
    });
  }
};

/**
 * Processa webhooks do Asaas
 * Implementa idempotência conforme recomendação da documentação
 */
const handleAsaasWebhook = async (req, res) => {
  try {
    // Verificar token de segurança (opcional, se configurado no Asaas)
    const receivedToken = req.header('asaas-access-token');
    const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN;
    
    // Somente verificar o token se estiver configurado no ambiente
    if (configuredToken && receivedToken !== configuredToken) {
      console.warn('Tentativa de acesso ao webhook com token inválido');
      return res.status(403).json({
        received: false,
        message: 'Token inválido'
      });
    }
    
    const db = await getDb();
    const eventData = req.body;
    const eventId = eventData.id || eventData.event; // Usar ID do evento ou o próprio evento como identificador
    
    // Verificar se o evento já foi processado (idempotência)
    const existingEvent = await db.collection('asaas_events').findOne({ asaas_event_id: eventId });
    if (existingEvent) {
      console.log(`Evento já processado anteriormente: ${eventId}`);
      return res.json({ received: true });
    }
    
    // Registrar evento antes de processar (idempotência)
    await db.collection('asaas_events').insertOne({
      asaas_event_id: eventId,
      payload: eventData,
      status: 'PENDING',
      createdAt: new Date()
    });
    
    // Processar diferentes tipos de eventos
    switch(eventData.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        // Atualizar status da assinatura para ACTIVE
        if (eventData.payment && eventData.payment.subscription) {
          const subscriptionId = eventData.payment.subscription;
          
          // Encontrar a assinatura pelo ID do Asaas
          const subscription = await db.collection('subscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (subscription) {
            // Calcular data de expiração (30 dias a partir de agora)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            
            // Atualizar assinatura
            await db.collection('subscriptions').updateOne(
              { asaasSubscriptionId: subscriptionId },
              { 
                $set: { 
                  status: 'ACTIVE',
                  expiryDate
                },
                $push: {
                  paymentHistory: {
                    paymentId: eventData.payment.id,
                    value: eventData.payment.value,
                    date: new Date(),
                    status: 'CONFIRMED'
                  }
                }
              }
            );
            
            console.log(`Assinatura ${subscriptionId} ativada com sucesso`);
          } else {
            console.warn(`Assinatura ${subscriptionId} não encontrada no banco de dados`);
          }
        }
        break;
        
      case 'PAYMENT_OVERDUE':
        // Marcar assinatura como atrasada
        if (eventData.payment && eventData.payment.subscription) {
          await db.collection('subscriptions').updateOne(
            { asaasSubscriptionId: eventData.payment.subscription },
            { 
              $set: { 
                status: 'OVERDUE' 
              },
              $push: {
                paymentHistory: {
                  paymentId: eventData.payment.id,
                  value: eventData.payment.value,
                  date: new Date(),
                  status: 'OVERDUE'
                }
              }
            }
          );
        }
        break;
        
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'SUBSCRIPTION_CANCELED':
        // Cancelar assinatura
        if (eventData.payment && eventData.payment.subscription) {
          await db.collection('subscriptions').updateOne(
            { asaasSubscriptionId: eventData.payment.subscription },
            { 
              $set: { 
                status: 'CANCELLED' 
              },
              $push: {
                paymentHistory: {
                  paymentId: eventData.payment?.id,
                  value: eventData.payment?.value,
                  date: new Date(),
                  status: 'CANCELLED'
                }
              }
            }
          );
        }
        break;
        
      default:
        console.log(`Evento não processado: ${eventData.event}`);
    }
    
    // Marcar evento como processado
    await db.collection('asaas_events').updateOne(
      { asaas_event_id: eventId },
      { $set: { status: 'DONE', processedAt: new Date() } }
    );
    
    return res.json({ received: true });
  } catch (error) {
    console.error('Erro ao processar webhook do Asaas:', error);
    return res.status(500).json({
      received: false,
      message: 'Erro interno ao processar webhook',
      error: error.message
    });
  }
};

/**
 * Cancela a assinatura do usuário
 */
const cancelSubscription = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    const db = await getDb();
    const subscription = await db.collection('subscriptions').findOne({
      userId: ObjectId.isValid(req.user._id) ? new ObjectId(req.user._id) : req.user._id,
      status: 'ACTIVE'
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma assinatura ativa encontrada'
      });
    }
    
    // Cancelar assinatura no Asaas
    try {
      await asaasAPI.delete(`/subscriptions/${subscription.asaasSubscriptionId}`);
    } catch (asaasError) {
      console.error('Erro ao cancelar assinatura no Asaas:', asaasError);
      // Continuar mesmo com erro no Asaas para garantir cancelamento local
    }
    
    // Atualizar status no banco local
    await db.collection('subscriptions').updateOne(
      { _id: subscription._id },
      { 
        $set: { 
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      }
    );
    
    return res.json({
      success: true,
      message: 'Assinatura cancelada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao cancelar assinatura',
      error: error.message
    });
  }
};

module.exports = {
  listPlans,
  createCheckout,
  checkSubscriptionStatus,
  handleAsaasWebhook,
  cancelSubscription
}; 