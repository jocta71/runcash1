/**
 * API para criação de checkout no Asaas
 * Permite que o usuário faça assinatura de planos premium
 */

const axios = require('axios');
const { ObjectId } = require('mongodb');
const getDb = require('../../services/database');

// Configuração do Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const IS_SANDBOX = process.env.NODE_ENV !== 'production' || ASAAS_API_URL.includes('sandbox');

// URL de retorno após pagamento (configurado dinamicamente)
const BASE_URL = process.env.APP_URL || 'https://runcashh11.vercel.app';

// Mapeamento de planos
const PLAN_MAPPING = {
  // Planos mensais
  'mensal': {
    name: 'Plano Mensal',
    value: 49.90,
    billingType: 'SUBSCRIPTION',
    cycle: 'MONTHLY',
    description: 'Assinatura mensal RunCash - Acesso a todas as roletas'
  },
  'trimestral': {
    name: 'Plano Trimestral',
    value: 129.90,
    billingType: 'SUBSCRIPTION',
    cycle: 'QUARTERLY',
    description: 'Assinatura trimestral RunCash - Acesso a todas as roletas com desconto'
  },
  'anual': {
    name: 'Plano Anual',
    value: 449.90,
    billingType: 'SUBSCRIPTION',
    cycle: 'YEARLY',
    description: 'Assinatura anual RunCash - Acesso a todas as roletas com máximo desconto'
  }
};

/**
 * Cria um checkout para assinatura no Asaas
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 */
const createCheckout = async (req, res) => {
  try {
    console.log('[Checkout] Iniciando criação de checkout com dados:', req.body);
    console.log('[Debug] URL da requisição:', req.originalUrl);
    console.log('[Debug] Headers da requisição:', req.headers);
    
    // Verificar se o usuário está autenticado
    if (!req.usuario || !req.usuario.id) {
      console.error('[Checkout] Usuário não autenticado');
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        error: 'AUTH_REQUIRED'
      });
    }
    
    // Extrair dados da requisição
    const { planId, asaasId } = req.body;
    
    if (!planId) {
      console.error('[Checkout] ID do plano não fornecido');
      return res.status(400).json({
        success: false,
        message: 'ID do plano não fornecido',
        error: 'MISSING_PLAN_ID'
      });
    }
    
    // Obter dados do plano
    const planData = PLAN_MAPPING[planId];
    if (!planData) {
      console.error(`[Checkout] Plano inválido: ${planId}`);
      return res.status(400).json({
        success: false,
        message: 'Plano inválido',
        error: 'INVALID_PLAN'
      });
    }
    
    // Obter info do usuário do banco de dados
    const db = await getDb();
    const user = await db.collection('users').findOne({ _id: req.usuario.id });
    
    if (!user) {
      console.error(`[Checkout] Usuário não encontrado: ${req.usuario.id}`);
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
        error: 'USER_NOT_FOUND'
      });
    }
    
    // Verificar se o usuário já tem um cliente Asaas
    let asaasCustomerId = user.asaasCustomerId;
    
    // Se não tiver um ID de cliente no Asaas, criar um novo
    if (!asaasCustomerId) {
      console.log('[Checkout] Cliente Asaas não encontrado, criando novo...');
      try {
        const customerResponse = await axios.post(
          `${ASAAS_API_URL}/customers`, 
          {
            name: user.nome || user.username || 'Cliente RunCash',
            email: user.email,
            phone: user.telefone || '',
            mobilePhone: user.celular || '',
            cpfCnpj: user.cpf || '',
            postalCode: user.cep || '',
            address: user.endereco || '',
            addressNumber: user.numero || '',
            complement: user.complemento || '',
            province: user.bairro || '',
            externalReference: user._id.toString(),
            notificationDisabled: false,
            observations: 'Cliente criado pela aplicação RunCash'
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY
            }
          }
        );
        
        asaasCustomerId = customerResponse.data.id;
        
        // Atualizar o usuário com o ID do cliente Asaas
        await db.collection('users').updateOne(
          { _id: req.usuario.id },
          { $set: { asaasCustomerId: asaasCustomerId } }
        );
        
        console.log(`[Checkout] Cliente Asaas criado com sucesso: ${asaasCustomerId}`);
      } catch (error) {
        console.error('[Checkout] Erro ao criar cliente Asaas:', error.response?.data || error.message);
        return res.status(500).json({
          success: false,
          message: 'Erro ao criar cliente no Asaas',
          error: error.response?.data?.errors || error.message
        });
      }
    }
    
    // Criar assinatura ou link de pagamento no Asaas
    try {
      console.log(`[Checkout] Criando ${planData.billingType} para o cliente ${asaasCustomerId}`);
      
      let paymentUrl;
      const callbackUrl = `${BASE_URL}/payment/success`;
      
      if (planData.billingType === 'SUBSCRIPTION') {
        // Criar assinatura
        const subscriptionResponse = await axios.post(
          `${ASAAS_API_URL}/subscriptions`,
          {
            customer: asaasCustomerId,
            billingType: 'CREDIT_CARD', // Tipo de cobrança (pode ser BOLETO, CREDIT_CARD, PIX, etc)
            nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Próximo dia
            value: planData.value,
            cycle: planData.cycle, // MONTHLY, QUARTERLY, YEARLY
            description: planData.description,
            externalReference: `${user._id.toString()}_${planId}`,
            autoStart: false // Não iniciar cobrança automaticamente
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY
            }
          }
        );
        
        const subscriptionId = subscriptionResponse.data.id;
        console.log(`[Checkout] Assinatura criada com sucesso: ${subscriptionId}`);
        
        // Obter link de pagamento para a assinatura
        const checkoutResponse = await axios.post(
          `${ASAAS_API_URL}/paymentLinks`,
          {
            name: planData.name,
            description: planData.description,
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias
            value: planData.value,
            billingType: ['CREDIT_CARD', 'PIX', 'BOLETO'],
            chargeType: 'SUBSCRIPTION',
            subscriptionId: subscriptionId,
            maxInstallmentCount: 1, // Não permitir parcelamento
            dueDateLimitDays: 10, // Limite de dias para pagamento do boleto
            notificationEnabled: true,
            callback: {
              successUrl: callbackUrl,
              autoRedirect: true
            },
            externalReference: `${user._id.toString()}_${planId}`
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY
            }
          }
        );
        
        paymentUrl = checkoutResponse.data.url;
        
        // Registrar no banco de dados
        await db.collection('assinaturas').insertOne({
          userId: user._id,
          asaasCustomerId,
          subscriptionId,
          planId,
          planName: planData.name,
          value: planData.value,
          cycle: planData.cycle,
          status: 'PENDING',
          paymentUrl,
          createdAt: new Date()
        });
      } else {
        // Criar pagamento único
        const paymentResponse = await axios.post(
          `${ASAAS_API_URL}/payments`,
          {
            customer: asaasCustomerId,
            billingType: 'UNDEFINED', // A ser definido no checkout
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 dias
            value: planData.value,
            description: planData.description,
            externalReference: `${user._id.toString()}_${planId}`
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY
            }
          }
        );
        
        const paymentId = paymentResponse.data.id;
        console.log(`[Checkout] Pagamento criado com sucesso: ${paymentId}`);
        
        // Obter link de pagamento
        const checkoutResponse = await axios.post(
          `${ASAAS_API_URL}/paymentLinks`,
          {
            name: planData.name,
            description: planData.description,
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias
            value: planData.value,
            billingType: ['CREDIT_CARD', 'PIX', 'BOLETO'],
            chargeType: 'DETACHED',
            paymentId: paymentId,
            maxInstallmentCount: 1, // Não permitir parcelamento
            dueDateLimitDays: 10, // Limite de dias para pagamento do boleto
            notificationEnabled: true,
            callback: {
              successUrl: callbackUrl,
              autoRedirect: true
            },
            externalReference: `${user._id.toString()}_${planId}`
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY
            }
          }
        );
        
        paymentUrl = checkoutResponse.data.url;
        
        // Registrar no banco de dados
        await db.collection('pagamentos').insertOne({
          userId: user._id,
          asaasCustomerId,
          paymentId,
          planId,
          planName: planData.name,
          value: planData.value,
          status: 'PENDING',
          paymentUrl,
          createdAt: new Date()
        });
      }
      
      // Responder com sucesso
      return res.status(200).json({
        success: true,
        message: 'Checkout criado com sucesso',
        paymentUrl,
        isSandbox: IS_SANDBOX
      });
    } catch (error) {
      console.error('[Checkout] Erro ao criar checkout:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar checkout',
        error: error.response?.data?.errors || error.message
      });
    }
  } catch (error) {
    console.error('[Checkout] Erro interno:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar checkout',
      error: error.message
    });
  }
};

/**
 * Busca ou cria um cliente no Asaas
 * @param {string} userId - ID do usuário no MongoDB
 * @returns {Object} Cliente no Asaas
 */
async function getOrCreateCustomer(userId) {
  try {
    const db = await getDb();
    
    // Buscar usuário no MongoDB
    const user = await db.collection('User').findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar se já tem ID do Asaas
    if (user.billingInfo && user.billingInfo.asaasId) {
      // Verificar se o cliente existe no Asaas
      try {
        const response = await axios.get(
          `${ASAAS_API_URL}/customers/${user.billingInfo.asaasId}`,
          {
            headers: {
              access_token: ASAAS_API_KEY
            }
          }
        );

        if (response.data && response.data.id) {
          return response.data;
        }
      } catch (error) {
        // Se o cliente não existir ou outro erro, continuamos para criar um novo
        console.warn('Cliente não encontrado no Asaas, criando novo:', error.message);
      }
    }

    // Criar novo cliente no Asaas
    const customerData = {
      name: user.name || user.email.split('@')[0],
      email: user.email,
      phone: user.phone || '',
      mobilePhone: user.mobilePhone || user.phone || '',
      cpfCnpj: user.billingInfo?.documentNumber || '',
      postalCode: user.billingInfo?.address?.postalCode || '',
      address: user.billingInfo?.address?.street || '',
      addressNumber: user.billingInfo?.address?.number || '',
      complement: user.billingInfo?.address?.complement || '',
      province: user.billingInfo?.address?.neighborhood || '',
      externalReference: userId
    };

    const response = await axios.post(
      `${ASAAS_API_URL}/customers`,
      customerData,
      {
        headers: {
          access_token: ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data || !response.data.id) {
      throw new Error('Erro ao criar cliente no Asaas');
    }

    // Atualizar usuário no MongoDB com o ID do Asaas
    await db.collection('User').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          'billingInfo.asaasId': response.data.id,
          updatedAt: new Date()
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Erro ao criar/obter cliente no Asaas:', error);
    throw error;
  }
}

module.exports = {
  createCheckout
}; 