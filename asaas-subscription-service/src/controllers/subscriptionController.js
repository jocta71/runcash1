const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { asaasApi } = require('../config/asaas');

// Criar cliente no Asaas
exports.createCustomer = async (req, res) => {
  try {
    const { name, email, cpfCnpj, phone } = req.body;
    
    // Validar campos obrigatórios
    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({
        success: false,
        message: 'Nome, email e CPF/CNPJ são obrigatórios'
      });
    }
    
    // Verificar se o usuário está autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    // Verificar se o usuário já tem um customer ID
    if (req.user.asaasCustomerId) {
      return res.status(200).json({
        success: true,
        message: 'Usuário já possui um ID de cliente no Asaas',
        data: {
          customerId: req.user.asaasCustomerId
        }
      });
    }
    
    // Criar cliente no Asaas
    const customerData = {
      name,
      email,
      cpfCnpj,
      mobilePhone: phone
    };
    
    const response = await asaasApi.post('/customers', customerData);
    
    if (!response.data || !response.data.id) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar cliente no Asaas'
      });
    }
    
    // Atualizar o usuário com o ID do cliente
    await User.findByIdAndUpdate(req.user._id, {
      asaasCustomerId: response.data.id
    });
    
    res.status(201).json({
      success: true,
      message: 'Cliente criado com sucesso no Asaas',
      data: {
        customerId: response.data.id
      }
    });
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar cliente no Asaas',
      error: process.env.NODE_ENV === 'development' 
        ? (error.response?.data || error.message) 
        : 'Erro no servidor'
    });
  }
};

// Criar assinatura no Asaas
exports.createSubscription = async (req, res) => {
  try {
    const { 
      plan, 
      value, 
      billingCycle = 'MONTHLY',
      paymentMethod = 'CREDIT_CARD'
    } = req.body;
    
    // Validar campos obrigatórios
    if (!plan || !value) {
      return res.status(400).json({
        success: false,
        message: 'Plano e valor são obrigatórios'
      });
    }
    
    // Verificar se o usuário está autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    // Verificar se o usuário já tem um customer ID
    if (!req.user.asaasCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'Usuário não possui um ID de cliente no Asaas. Crie um cliente primeiro.'
      });
    }
    
    // Verificar se o usuário já tem uma assinatura ativa
    const existingSubscription = await Subscription.findOne({
      userId: req.user._id,
      status: 'active'
    });
    
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Usuário já possui uma assinatura ativa',
        data: {
          subscription: existingSubscription
        }
      });
    }
    
    // Definir descrição com base no plano
    let description = '';
    switch (plan) {
      case 'basic':
        description = 'Plano Básico - Acesso a roletas';
        break;
      case 'premium':
        description = 'Plano Premium - Acesso completo a roletas e estratégias';
        break;
      case 'pro':
        description = 'Plano Pro - Acesso completo a roletas, estratégias e suporte VIP';
        break;
      default:
        description = `Plano ${plan} - Acesso a recursos do RunCash`;
    }
    
    // Criar assinatura no Asaas
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1); // Primeira cobrança no dia seguinte
    
    const subscriptionData = {
      customer: req.user.asaasCustomerId,
      billingType: paymentMethod,
      value,
      nextDueDate: nextDueDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
      description,
      cycle: billingCycle
    };
    
    const response = await asaasApi.post('/subscriptions', subscriptionData);
    
    if (!response.data || !response.data.id) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar assinatura no Asaas'
      });
    }
    
    // Criar assinatura no banco de dados
    const subscription = new Subscription({
      userId: req.user._id,
      asaasCustomerId: req.user.asaasCustomerId,
      asaasSubscriptionId: response.data.id,
      status: 'inactive', // Começa como inativa até o primeiro pagamento
      plan,
      value,
      paymentMethod,
      billingCycle,
      description,
      nextDueDate
    });
    
    await subscription.save();
    
    res.status(201).json({
      success: true,
      message: 'Assinatura criada com sucesso',
      data: {
        subscription,
        paymentUrl: `${process.env.ASAAS_API_URL.replace('/api/v3', '')}/payment/${response.data.id}`
      }
    });
  } catch (error) {
    console.error('Erro ao criar assinatura:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar assinatura',
      error: process.env.NODE_ENV === 'development' 
        ? (error.response?.data || error.message) 
        : 'Erro no servidor'
    });
  }
};

// Obter status da assinatura do usuário
exports.getSubscriptionStatus = async (req, res) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    // Buscar assinatura do usuário
    const subscription = await Subscription.findOne({
      userId: req.user._id
    }).sort({ createdAt: -1 }); // Buscar a mais recente
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma assinatura encontrada para este usuário',
        data: {
          hasActiveSubscription: false
        }
      });
    }
    
    // Se a assinatura não estiver ativa, verificar status no Asaas
    if (subscription.status !== 'active') {
      try {
        const response = await asaasApi.get(`/subscriptions/${subscription.asaasSubscriptionId}`);
        
        if (response.data && response.data.status) {
          // Atualizar status da assinatura no banco de dados
          if (response.data.status === 'ACTIVE' && subscription.status !== 'active') {
            subscription.status = 'active';
            await subscription.save();
          } else if (response.data.status === 'INACTIVE' && subscription.status !== 'inactive') {
            subscription.status = 'inactive';
            await subscription.save();
          }
        }
      } catch (asaasError) {
        console.error('Erro ao verificar status no Asaas:', asaasError);
        // Continue mesmo com erro na API Asaas
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        hasActiveSubscription: subscription.status === 'active',
        subscription
      }
    });
  } catch (error) {
    console.error('Erro ao obter status da assinatura:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter status da assinatura',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro no servidor'
    });
  }
};

// Cancelar assinatura
exports.cancelSubscription = async (req, res) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    // Buscar assinatura ativa do usuário
    const subscription = await Subscription.findOne({
      userId: req.user._id,
      status: 'active'
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma assinatura ativa encontrada para este usuário'
      });
    }
    
    // Cancelar assinatura no Asaas
    await asaasApi.post(`/subscriptions/${subscription.asaasSubscriptionId}/cancel`);
    
    // Atualizar status da assinatura no banco de dados
    subscription.status = 'canceled';
    await subscription.save();
    
    res.status(200).json({
      success: true,
      message: 'Assinatura cancelada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao cancelar assinatura',
      error: process.env.NODE_ENV === 'development' 
        ? (error.response?.data || error.message) 
        : 'Erro no servidor'
    });
  }
}; 