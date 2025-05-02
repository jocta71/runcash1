/**
 * Controller para gerenciamento de assinaturas via Asaas
 * Implementa checkout, webhooks e gerenciamento de assinaturas
 */

const axios = require('axios');
const crypto = require('crypto');
const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

// Configuração do Asaas API
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN; // Token para validar webhooks

// Mapeamento de planos para valores e descrições
const PLANS = {
  'basic': {
    name: 'Plano Básico',
    value: 49.90,
    cycle: 'MONTHLY',
    description: 'Assinatura Mensal - Acesso Básico a Roletas'
  },
  'pro': {
    name: 'Plano Profissional',
    value: 49.90,
    cycle: 'MONTHLY',
    description: 'Assinatura Mensal - Acesso PRO a Roletas'
  },
  'premium': {
    name: 'Plano Premium',
    value: 99.90,
    cycle: 'MONTHLY',
    description: 'Assinatura Mensal - Acesso PREMIUM a Roletas'
  }
};

/**
 * Cria um checkout de assinatura no Asaas
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.createCheckout = async (req, res) => {
  try {
    const { planId, userId } = req.body;
    
    // Verificar se o plano é válido
    if (!planId || !PLANS[planId]) {
      return res.status(400).json({
        success: false,
        message: 'Plano inválido',
        error: 'INVALID_PLAN'
      });
    }
    
    // Verificar se o usuário está autenticado e se o ID corresponde ao token
    if (!req.user || req.user.id !== userId) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado',
        error: 'UNAUTHORIZED'
      });
    }
    
    // Obter o usuário do banco de dados para detalhes completos
    const db = await getDb();
    const userRecord = await db.collection('users').findOne({
      _id: new ObjectId(userId)
    });
    
    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
        error: 'USER_NOT_FOUND'
      });
    }
    
    // Verificar se o usuário já é cliente no Asaas
    let asaasCustomerId = userRecord.asaasCustomerId;
    
    // Se não for cliente, criar cliente no Asaas
    if (!asaasCustomerId) {
      try {
        const customerResponse = await axios.post(
          `${ASAAS_API_URL}/customers`, 
          {
            name: userRecord.name || userRecord.username,
            email: userRecord.email,
            phone: userRecord.phone || '11999999999', // Telefone padrão se não tiver
            cpfCnpj: userRecord.cpf || '00000000000' // CPF padrão se não tiver
          },
          {
            headers: {
              'access_token': ASAAS_API_KEY
            }
          }
        );
        
        if (customerResponse.data && customerResponse.data.id) {
          asaasCustomerId = customerResponse.data.id;
          
          // Atualizar o registro do usuário com o ID do cliente no Asaas
          await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { asaasCustomerId } }
          );
        } else {
          throw new Error('Falha ao criar cliente no Asaas');
        }
      } catch (error) {
        console.error('Erro ao criar cliente no Asaas:', error);
        return res.status(500).json({
          success: false,
          message: 'Erro ao criar cliente no Asaas',
          error: 'ASAAS_API_ERROR'
        });
      }
    }
    
    // Obter detalhes do plano
    const plan = PLANS[planId];
    
    // Criar assinatura no Asaas
    try {
      // URL de retorno após o pagamento
      const callbackUrl = `${req.protocol}://${req.get('host')}/planos`;
      
      const subscriptionData = {
        customer: asaasCustomerId,
        billingType: 'PIX', // Padrão: PIX (pode ser alterado no checkout)
        nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Amanhã
        value: plan.value,
        cycle: plan.cycle,
        description: plan.description,
        creditCard: {
          holderName: '',
          number: '',
          expiryMonth: '',
          expiryYear: '',
          ccv: ''
        },
        creditCardHolderInfo: {
          name: '',
          email: '',
          cpfCnpj: '',
          postalCode: '',
          addressNumber: '',
          addressComplement: '',
          phone: ''
        },
        remoteIp: req.ip // IP do cliente
      };
      
      const subscriptionResponse = await axios.post(
        `${ASAAS_API_URL}/subscriptions`, 
        subscriptionData,
        {
          headers: {
            'access_token': ASAAS_API_KEY
          }
        }
      );
      
      if (!subscriptionResponse.data || !subscriptionResponse.data.id) {
        throw new Error('Falha ao criar assinatura no Asaas');
      }
      
      // Gerar URL de checkout
      const checkoutResponse = await axios.get(
        `${ASAAS_API_URL}/subscriptions/${subscriptionResponse.data.id}/checkout`,
        {
          headers: {
            'access_token': ASAAS_API_KEY
          }
        }
      );
      
      if (!checkoutResponse.data || !checkoutResponse.data.url) {
        throw new Error('Falha ao gerar URL de checkout');
      }
      
      // Registrar a assinatura no banco de dados local
      await db.collection('subscriptions').insertOne({
        userId: new ObjectId(userId),
        asaasSubscriptionId: subscriptionResponse.data.id,
        asaasCustomerId,
        planId,
        planName: plan.name,
        value: plan.value,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Retornar URL de checkout para o frontend
      return res.json({
        success: true,
        message: 'Checkout criado com sucesso',
        checkoutUrl: checkoutResponse.data.url
      });
      
    } catch (error) {
      console.error('Erro ao criar checkout:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar checkout',
        error: 'CHECKOUT_ERROR'
      });
    }
  } catch (error) {
    console.error('Erro no controller de checkout:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno no servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * Processa webhooks do Asaas
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.handleWebhook = async (req, res) => {
  try {
    // Verificar token do webhook para segurança (se configurado)
    if (ASAAS_WEBHOOK_TOKEN) {
      const token = req.headers['asaas-webhook-token'] || '';
      if (token !== ASAAS_WEBHOOK_TOKEN) {
        console.warn('Tentativa de webhook com token inválido:', token);
        return res.status(401).json({
          success: false,
          message: 'Token de webhook inválido'
        });
      }
    }
    
    // Obter dados do webhook
    const webhookData = req.body;
    const eventId = webhookData.id;
    
    // Verificar se o evento já foi processado (idempotência)
    const db = await getDb();
    const existingEvent = await db.collection('processed_webhooks').findOne({ eventId });
    
    if (existingEvent) {
      console.log(`Evento já processado: ${eventId}`);
      return res.json({
        success: true,
        message: 'Evento já processado anteriormente',
        received: true
      });
    }
    
    // Processar o evento com base no tipo
    console.log(`Processando webhook: ${webhookData.event}`);
    
    switch (webhookData.event) {
      case 'PAYMENT_CONFIRMED': {
        // Encontrar a assinatura relacionada ao pagamento
        const payment = webhookData.payment;
        
        // Verificar se o pagamento está relacionado a uma assinatura
        if (payment && payment.subscription) {
          const subscriptionId = payment.subscription;
          
          // Buscar a assinatura no banco local
          const subscription = await db.collection('subscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (subscription) {
            // Atualizar status da assinatura para ACTIVE
            await db.collection('subscriptions').updateOne(
              { asaasSubscriptionId: subscriptionId },
              { 
                $set: { 
                  status: 'ACTIVE',
                  lastPaymentId: payment.id,
                  lastPaymentDate: new Date(),
                  updatedAt: new Date()
                } 
              }
            );
            
            // Atualizar status do usuário para com assinatura ativa
            await db.collection('users').updateOne(
              { _id: subscription.userId },
              { 
                $set: { 
                  subscriptionStatus: 'ACTIVE',
                  subscriptionPlan: subscription.planId,
                  subscriptionUpdatedAt: new Date()
                } 
              }
            );
            
            console.log(`Assinatura ativada: ${subscriptionId}`);
          }
        }
        break;
      }
      
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_APPROVED': {
        // Lógica semelhante ao PAYMENT_CONFIRMED
        const payment = webhookData.payment;
        
        if (payment && payment.subscription) {
          const subscriptionId = payment.subscription;
          const subscription = await db.collection('subscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (subscription) {
            await db.collection('subscriptions').updateOne(
              { asaasSubscriptionId: subscriptionId },
              { 
                $set: { 
                  status: 'ACTIVE',
                  lastPaymentId: payment.id,
                  lastPaymentDate: new Date(),
                  updatedAt: new Date()
                } 
              }
            );
            
            await db.collection('users').updateOne(
              { _id: subscription.userId },
              { 
                $set: { 
                  subscriptionStatus: 'ACTIVE',
                  subscriptionPlan: subscription.planId,
                  subscriptionUpdatedAt: new Date()
                } 
              }
            );
          }
        }
        break;
      }
      
      case 'PAYMENT_OVERDUE': {
        // Pagamento atrasado, marcar assinatura como atrasada
        const payment = webhookData.payment;
        
        if (payment && payment.subscription) {
          const subscriptionId = payment.subscription;
          
          await db.collection('subscriptions').updateOne(
            { asaasSubscriptionId: subscriptionId },
            { 
              $set: { 
                status: 'OVERDUE',
                updatedAt: new Date()
              } 
            }
          );
          
          // Atualizar usuário para refletir assinatura atrasada
          const subscription = await db.collection('subscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (subscription) {
            await db.collection('users').updateOne(
              { _id: subscription.userId },
              { 
                $set: { 
                  subscriptionStatus: 'OVERDUE',
                  subscriptionUpdatedAt: new Date()
                } 
              }
            );
          }
        }
        break;
      }
      
      case 'SUBSCRIPTION_CANCELLED': {
        // Assinatura cancelada
        const subscription = webhookData.subscription;
        
        if (subscription) {
          const subscriptionId = subscription.id;
          
          await db.collection('subscriptions').updateOne(
            { asaasSubscriptionId: subscriptionId },
            { 
              $set: { 
                status: 'CANCELLED',
                cancelledAt: new Date(),
                updatedAt: new Date()
              } 
            }
          );
          
          // Atualizar usuário
          const localSubscription = await db.collection('subscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (localSubscription) {
            await db.collection('users').updateOne(
              { _id: localSubscription.userId },
              { 
                $set: { 
                  subscriptionStatus: 'CANCELLED',
                  subscriptionUpdatedAt: new Date()
                } 
              }
            );
          }
        }
        break;
      }
      
      case 'SUBSCRIPTION_ENDED': {
        // Assinatura encerrada (chegou ao fim do período)
        const subscription = webhookData.subscription;
        
        if (subscription) {
          const subscriptionId = subscription.id;
          
          await db.collection('subscriptions').updateOne(
            { asaasSubscriptionId: subscriptionId },
            { 
              $set: { 
                status: 'ENDED',
                endedAt: new Date(),
                updatedAt: new Date()
              } 
            }
          );
          
          // Atualizar usuário
          const localSubscription = await db.collection('subscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (localSubscription) {
            await db.collection('users').updateOne(
              { _id: localSubscription.userId },
              { 
                $set: { 
                  subscriptionStatus: 'ENDED',
                  subscriptionUpdatedAt: new Date()
                } 
              }
            );
          }
        }
        break;
      }
      
      default:
        console.log(`Tipo de evento não processado: ${webhookData.event}`);
    }
    
    // Registrar evento como processado
    await db.collection('processed_webhooks').insertOne({
      eventId,
      event: webhookData.event,
      data: webhookData,
      processedAt: new Date()
    });
    
    // Responder ao Asaas
    return res.json({
      success: true,
      message: 'Webhook processado com sucesso',
      received: true
    });
    
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    
    // Mesmo em caso de erro, responder com 200 para o Asaas não reenviar o webhook
    return res.status(200).json({
      success: false,
      message: 'Erro ao processar webhook, mas foi recebido',
      received: true,
      error: error.message
    });
  }
};

/**
 * Cancela uma assinatura ativa
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'ID da assinatura não informado',
        error: 'MISSING_SUBSCRIPTION_ID'
      });
    }
    
    // Verificar se a assinatura pertence ao usuário autenticado
    const db = await getDb();
    const subscription = await db.collection('subscriptions').findOne({
      asaasSubscriptionId: subscriptionId,
      userId: new ObjectId(req.user.id)
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Assinatura não encontrada ou não pertence ao usuário',
        error: 'SUBSCRIPTION_NOT_FOUND'
      });
    }
    
    // Cancelar assinatura no Asaas
    try {
      await axios.delete(
        `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
        {
          headers: {
            'access_token': ASAAS_API_KEY
          }
        }
      );
      
      // Atualizar status da assinatura no banco local
      await db.collection('subscriptions').updateOne(
        { asaasSubscriptionId: subscriptionId },
        { 
          $set: { 
            status: 'CANCELLED',
            cancelledAt: new Date(),
            updatedAt: new Date()
          } 
        }
      );
      
      // Atualizar status do usuário
      await db.collection('users').updateOne(
        { _id: new ObjectId(req.user.id) },
        { 
          $set: { 
            subscriptionStatus: 'CANCELLED',
            subscriptionUpdatedAt: new Date()
          } 
        }
      );
      
      return res.json({
        success: true,
        message: 'Assinatura cancelada com sucesso'
      });
      
    } catch (error) {
      console.error('Erro ao cancelar assinatura no Asaas:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao cancelar assinatura no Asaas',
        error: 'ASAAS_API_ERROR'
      });
    }
    
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno no servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * Lista assinaturas do usuário
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.listUserSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Buscar assinaturas do usuário no banco local
    const db = await getDb();
    const subscriptions = await db.collection('subscriptions')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();
    
    return res.json({
      success: true,
      data: subscriptions
    });
    
  } catch (error) {
    console.error('Erro ao listar assinaturas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno no servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}; 