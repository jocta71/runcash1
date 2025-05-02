/**
 * API para criação de checkout no Asaas
 * Permite que o usuário faça assinatura de planos premium
 */

const axios = require('axios');
const { ObjectId } = require('mongodb');
const getDb = require('../../services/database');

// Configuração do Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_WEBHOOK_URL = process.env.ASAAS_WEBHOOK_URL || 'https://api.runcash.app/api/webhooks/asaas';

// Mapeamento de planos
const PLANOS = {
  basic: {
    nome: 'Plano Básico RunCash',
    valor: 4990,
    ciclo: 'MONTHLY'
  },
  premium: {
    nome: 'Plano Premium RunCash',
    valor: 9990,
    ciclo: 'MONTHLY'
  },
  pro: {
    nome: 'Plano Profissional RunCash',
    valor: 17990,
    ciclo: 'MONTHLY'
  }
};

/**
 * Cria um checkout para assinatura no Asaas
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 */
const createCheckout = async (req, res) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user && !req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        error: 'AUTH_REQUIRED'
      });
    }

    const { planId, value, billingCycle = 'MONTHLY' } = req.body;
    const userId = req.user?.id || req.usuario?.id;

    // Validar o plano
    if (!planId || !PLANOS[planId.toLowerCase()]) {
      return res.status(400).json({
        success: false,
        message: 'Plano inválido',
        error: 'INVALID_PLAN'
      });
    }

    // Obter dados do plano
    const plano = PLANOS[planId.toLowerCase()];
    const customer = await getOrCreateCustomer(userId);

    if (!customer || !customer.id) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao obter/criar cliente no Asaas',
        error: 'CUSTOMER_ERROR'
      });
    }

    // Criar checkout
    const checkoutData = {
      customer: customer.id,
      billingType: ['CREDIT_CARD', 'PIX', 'BOLETO'], // Aceitar múltiplos métodos
      dueDate: new Date(Date.now() + 3600 * 1000).toISOString().split('T')[0], // 1 hora após a criação
      value: plano.valor / 100, // Valor em reais
      description: plano.nome,
      externalReference: `PLANO_${planId.toUpperCase()}_USER_${userId}`,
      subscriptionSettings: {
        enabled: true,
        billingCycle: plano.ciclo,
        nextDueDate: new Date(Date.now() + 3600 * 1000).toISOString().split('T')[0]
      },
      notificationEnabled: true,
      callbackUrl: ASAAS_WEBHOOK_URL
    };

    // Chamar API do Asaas para criar checkout
    const response = await axios.post(
      `${ASAAS_API_URL}/checkouts`,
      checkoutData,
      {
        headers: {
          access_token: ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data || !response.data.id) {
      console.error('Erro na resposta do Asaas:', response.data);
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar checkout no Asaas',
        error: 'CHECKOUT_CREATION_ERROR'
      });
    }

    // Registrar o checkout no MongoDB
    const db = await getDb();
    await db.collection('Checkout').insertOne({
      userId: new ObjectId(userId),
      checkoutId: response.data.id,
      planId: planId,
      status: 'PENDING',
      value: plano.valor / 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        asaasResponse: response.data
      }
    });

    // Retornar URL de checkout
    return res.status(200).json({
      success: true,
      message: 'Checkout criado com sucesso',
      checkoutId: response.data.id,
      checkoutUrl: response.data.url
    });
  } catch (error) {
    console.error('Erro ao criar checkout:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar checkout',
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