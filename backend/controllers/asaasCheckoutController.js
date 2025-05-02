/**
 * Controlador para criar e gerenciar checkouts do Asaas
 * Permite criar links de pagamento direto pelo Asaas
 */

const axios = require('axios');
const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

// Configurações do Asaas
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://runcashh11.vercel.app';

/**
 * Cria um checkout do Asaas para assinatura
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 */
const createSubscriptionCheckout = async (req, res) => {
  try {
    const { planType } = req.body;
    
    // Validar tipo de plano
    if (!['BASIC', 'PRO', 'PREMIUM'].includes(planType)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de plano inválido. Use BASIC, PRO ou PREMIUM.'
      });
    }
    
    // Obter ID do usuário do token
    const userId = req.user ? req.user.id : null;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }
    
    // Obter informações do usuário
    const db = await getDb();
    const user = await db.collection('users').findOne({
      _id: ObjectId.isValid(userId) ? new ObjectId(userId) : null
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Definir configurações do plano
    let planConfig = {
      name: 'Plano Básico RunCash',
      value: 29.90,
      billingType: 'CREDIT_CARD',
      description: 'BASIC - Acesso básico às roletas e estatísticas',
      cycle: 'MONTHLY'
    };
    
    if (planType === 'PRO') {
      planConfig = {
        name: 'Plano Pro RunCash',
        value: 49.90,
        billingType: 'CREDIT_CARD',
        description: 'PRO - Acesso a todas as roletas e estatísticas em tempo real',
        cycle: 'MONTHLY'
      };
    } else if (planType === 'PREMIUM') {
      planConfig = {
        name: 'Plano Premium RunCash',
        value: 99.90,
        billingType: 'CREDIT_CARD',
        description: 'PREMIUM - Acesso completo a todas as funcionalidades exclusivas',
        cycle: 'MONTHLY'
      };
    }
    
    // Verificar se o usuário já tem customer_id no Asaas
    let customerId = user.asaas_customer_id;
    
    // Se não tiver, criar cliente no Asaas
    if (!customerId) {
      try {
        console.log(`[AsaasCheckout] Criando cliente no Asaas para o usuário ${userId}`);
        
        const customerData = {
          name: user.name || user.displayName || 'Usuário RunCash',
          email: user.email,
          externalReference: userId,
          notificationDisabled: false
        };
        
        // Adicionar CPF se disponível
        if (user.cpf) {
          customerData.cpfCnpj = user.cpf;
        }
        
        // Adicionar telefone se disponível
        if (user.phone) {
          customerData.phone = user.phone;
        }
        
        const customerResponse = await axios.post(
          `${ASAAS_API_URL}/customers`,
          customerData,
          {
            headers: {
              'access_token': ASAAS_API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (customerResponse.data && customerResponse.data.id) {
          customerId = customerResponse.data.id;
          
          // Atualizar usuário com o customer_id
          await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { asaas_customer_id: customerId } }
          );
          
          console.log(`[AsaasCheckout] Cliente criado com sucesso no Asaas: ${customerId}`);
        } else {
          throw new Error('Resposta inválida ao criar cliente no Asaas');
        }
      } catch (error) {
        console.error('[AsaasCheckout] Erro ao criar cliente no Asaas:', error);
        return res.status(500).json({
          success: false,
          message: 'Erro ao criar cliente no Asaas',
          error: error.message
        });
      }
    }
    
    // Data de vencimento (amanhã)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDate = tomorrow.toISOString().split('T')[0];
    
    // Criar objeto do checkout
    const checkoutData = {
      customer: customerId,
      billingType: planConfig.billingType,
      value: planConfig.value,
      dueDate: dueDate,
      description: planConfig.description,
      externalReference: `${userId}_${planType}`,
      installmentCount: 0, // Assinatura recorrente
      installmentValue: planConfig.value,
      maxInstallmentCount: 12,
      paymentTypes: ['CREDIT_CARD', 'PIX', 'BOLETO'],
      subscription: {
        cycle: planConfig.cycle,
        description: planType // Importante para identificar o tipo de plano
      },
      successUrl: `${FRONTEND_URL}/account/redirect?status=success`,
      cartItems: [{
        name: planConfig.name,
        value: planConfig.value,
        quantity: 1
      }]
    };
    
    console.log(`[AsaasCheckout] Criando checkout para usuário ${userId}, plano ${planType}`);
    
    // Criar checkout do Asaas
    try {
      const checkoutResponse = await axios.post(
        `${ASAAS_API_URL}/checkouts`,
        checkoutData,
        {
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (checkoutResponse.data && checkoutResponse.data.url) {
        console.log(`[AsaasCheckout] Checkout criado com sucesso: ${checkoutResponse.data.id}`);
        
        // Registrar o checkout na nossa base
        await db.collection('asaas_checkouts').insertOne({
          user_id: userId,
          asaas_customer_id: customerId,
          checkout_id: checkoutResponse.data.id,
          plan_type: planType,
          value: planConfig.value,
          created_at: new Date(),
          status: 'PENDING'
        });
        
        // Retornar URL do checkout
        return res.json({
          success: true,
          checkoutUrl: checkoutResponse.data.url,
          checkoutId: checkoutResponse.data.id
        });
      } else {
        throw new Error('Resposta inválida ao criar checkout no Asaas');
      }
    } catch (error) {
      console.error('[AsaasCheckout] Erro ao criar checkout no Asaas:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar checkout no Asaas',
        error: error.message
      });
    }
  } catch (error) {
    console.error('[AsaasCheckout] Erro geral ao criar checkout:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar requisição de checkout',
      error: error.message
    });
  }
};

/**
 * Verifica o status de um checkout
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 */
const getCheckoutStatus = async (req, res) => {
  try {
    const { checkoutId } = req.params;
    
    if (!checkoutId) {
      return res.status(400).json({
        success: false,
        message: 'ID do checkout não fornecido'
      });
    }
    
    // Buscar status no Asaas
    const response = await axios.get(
      `${ASAAS_API_URL}/checkouts/${checkoutId}`,
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    );
    
    if (response.data) {
      return res.json({
        success: true,
        status: response.data.status,
        data: response.data
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Checkout não encontrado'
      });
    }
  } catch (error) {
    console.error('[AsaasCheckout] Erro ao verificar status do checkout:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status do checkout',
      error: error.message
    });
  }
};

module.exports = {
  createSubscriptionCheckout,
  getCheckoutStatus
}; 