const { ObjectId } = require('mongodb');
const getDb = require('../services/database');
const asaasService = require('../services/asaasService');

// Lista de planos disponíveis
const PLANS = [
  {
    id: 'basic',
    name: 'Plano Básico',
    description: 'Acesso limitado às roletas e funcionalidades básicas',
    value: 29.90,
    billingCycle: 'MONTHLY',
    features: [
      'Acesso a 10 roletas',
      'Histórico de 20 números por roleta',
      'Atualizações a cada 30 segundos'
    ]
  },
  {
    id: 'premium',
    name: 'Plano Premium',
    description: 'Acesso completo a todas as roletas e funcionalidades',
    value: 49.90,
    billingCycle: 'MONTHLY',
    features: [
      'Acesso a todas as roletas',
      'Histórico completo de números',
      'Atualizações em tempo real',
      'Estatísticas avançadas',
      'Notificações personalizadas'
    ]
  },
  {
    id: 'yearly_premium',
    name: 'Plano Premium Anual',
    description: 'Acesso completo com desconto especial pagamento anual',
    value: 479.90, // ~40/mês (20% de desconto)
    billingCycle: 'YEARLY',
    features: [
      'Todos os benefícios do Plano Premium',
      'Economia de 20% em relação ao pagamento mensal',
      'Suporte prioritário'
    ]
  }
];

/**
 * Lista todos os planos disponíveis
 */
const getPlans = async (req, res) => {
  try {
    return res.json({
      success: true,
      data: PLANS
    });
  } catch (error) {
    console.error('Erro ao listar planos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter planos disponíveis'
    });
  }
};

/**
 * Cria uma nova assinatura usando o Asaas
 */
const createSubscription = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id;

    // Validar plano
    const selectedPlan = PLANS.find(plan => plan.id === planId);
    if (!selectedPlan) {
      return res.status(400).json({
        success: false,
        message: 'Plano não encontrado'
      });
    }

    const db = await getDb();
    
    // Buscar usuário
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar se já tem assinatura ativa
    if (user.subscription && user.subscription.active && user.subscription.asaasSubscriptionId) {
      // Se já tiver assinatura, redirecionar para página de gerenciamento
      const asaasSubscription = await asaasService.getSubscription(user.subscription.asaasSubscriptionId);
      
      if (asaasSubscription && asaasSubscription.status === 'ACTIVE') {
        return res.json({
          success: true,
          message: 'Usuário já possui assinatura ativa',
          alreadySubscribed: true,
          subscription: {
            id: asaasSubscription.id,
            status: asaasSubscription.status,
            value: asaasSubscription.value,
            nextDueDate: asaasSubscription.nextDueDate
          }
        });
      }
    }

    // Criar assinatura no Asaas
    const subscription = await asaasService.createSubscription({
      customer: user.asaasCustomerId,
      billingType: 'CREDIT_CARD', // Ou outra opção
      value: selectedPlan.value,
      nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 dia a frente
      cycle: selectedPlan.billingCycle,
      description: `Assinatura ${selectedPlan.name}`,
      creditCardHolderInfo: null, // Será preenchido pelo checkout
      creditCard: null // Será preenchido pelo checkout
    });

    // Gerar URL de checkout
    const checkoutUrl = await asaasService.generateCheckoutUrl({
      subscription: subscription.id,
      name: user.name,
      email: user.email,
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/success`
    });

    return res.json({
      success: true,
      checkoutUrl,
      subscription: {
        id: subscription.id,
        plan: selectedPlan.id,
        value: selectedPlan.value
      }
    });
  } catch (error) {
    console.error('Erro ao criar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar assinatura',
      error: error.message
    });
  }
};

/**
 * Obtém informações da assinatura atual do usuário
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDb();

    // Buscar usuário
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Se não tiver assinatura, retornar status FREE
    if (!user.subscription || !user.subscription.asaasSubscriptionId) {
      return res.json({
        success: true,
        subscription: {
          status: 'FREE',
          active: false,
          planType: 'FREE'
        }
      });
    }

    // Buscar assinatura no Asaas para obter status atualizado
    try {
      const asaasSubscription = await asaasService.getSubscription(user.subscription.asaasSubscriptionId);
      
      // Status Asaas: ACTIVE, EXPIRED, OVERDUE, CANCELED
      const isActive = asaasSubscription.status === 'ACTIVE';
      
      // Atualizar status no banco se necessário
      if (user.subscription.active !== isActive) {
        await db.collection('users').updateOne(
          { _id: user._id },
          { 
            $set: { 
              'subscription.active': isActive,
              'subscription.status': asaasSubscription.status
            }
          }
        );
      }
      
      return res.json({
        success: true,
        subscription: {
          id: asaasSubscription.id,
          status: asaasSubscription.status,
          active: isActive,
          value: asaasSubscription.value,
          nextDueDate: asaasSubscription.nextDueDate,
          planType: user.subscription.planType || 'BASIC'
        }
      });
    } catch (error) {
      // Em caso de erro ao consultar a API, retornar os dados locais
      console.error('Erro ao consultar assinatura no Asaas:', error);
      return res.json({
        success: true,
        subscription: {
          id: user.subscription.asaasSubscriptionId,
          status: user.subscription.status || 'UNKNOWN',
          active: user.subscription.active || false,
          planType: user.subscription.planType || 'BASIC',
          localOnly: true // Indica que são apenas dados locais
        }
      });
    }
  } catch (error) {
    console.error('Erro ao obter status da assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter status da assinatura',
      error: error.message
    });
  }
};

module.exports = {
  getPlans,
  createSubscription,
  getSubscriptionStatus
}; 