/**
 * Endpoint unificado para operações de assinatura
 * Combina várias funções em uma única para economizar funções serverless
 * 
 * Operações suportadas:
 * - create: Criar uma nova assinatura (antigo asaas-create-subscription)
 * - find: Buscar dados de uma assinatura (antigo asaas-find-subscription)
 * - cancel: Cancelar uma assinatura (antigo asaas-cancel-subscription)
 * - update: Atualizar uma assinatura
 * - change-payment: Alterar forma de pagamento
 * - list: Listar assinaturas de um cliente
 */

// Importações
const axios = require('axios');
const qrcode = require('qrcode');

// Configurações
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Headers para requisições à API do Asaas
const asaasHeaders = {
  'Content-Type': 'application/json',
  'access_token': ASAAS_API_KEY
};

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Obter o tipo de operação da query ou body
  const operation = req.query.operation || (req.body && req.body.operation);
  
  if (!operation) {
    return res.status(400).json({
      success: false,
      error: 'Operação não especificada. Inclua o parâmetro "operation" na query ou body.'
    });
  }

  // Executar a operação correspondente
  try {
    switch (operation) {
      case 'create':
        return await createSubscription(req, res);
      
      case 'find':
        return await findSubscription(req, res);
      
      case 'cancel':
        return await cancelSubscription(req, res);
      
      case 'update':
        return await updateSubscription(req, res);
      
      case 'change-payment':
        return await changePaymentMethod(req, res);
      
      case 'list':
        return await listSubscriptions(req, res);
      
      default:
        return res.status(400).json({
          success: false,
          error: `Operação "${operation}" não suportada.`
        });
    }
  } catch (error) {
    console.error(`Erro na operação ${operation}:`, error);
    
    return res.status(500).json({
      success: false,
      error: `Erro ao executar operação "${operation}"`,
      message: error.message || 'Erro interno do servidor'
    });
  }
};

/**
 * Criar uma nova assinatura (antigo asaas-create-subscription)
 */
async function createSubscription(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST para criar assinatura.'
    });
  }

  // Validar campos obrigatórios
  const { customerId, planId } = req.body;
  
  if (!customerId) {
    return res.status(400).json({
      success: false,
      error: 'ID do cliente (customerId) é obrigatório'
    });
  }
  
  if (!planId) {
    return res.status(400).json({
      success: false,
      error: 'ID do plano (planId) é obrigatório'
    });
  }

  // Preços oficiais dos planos
  const planPrices = {
    'starter': 29.90,
    'pro': 59.90,
    'enterprise': 119.90
  };

  const planValues = {
    'starter': {
      name: 'Plano Starter',
      value: 29.90
    },
    'pro': {
      name: 'Plano Pro',
      value: 59.90
    },
    'enterprise': {
      name: 'Plano Enterprise',
      value: 119.90
    }
  };

  // Verificar se o plano é válido
  if (!planValues[planId]) {
    return res.status(400).json({
      success: false,
      error: 'ID do plano inválido. Opções disponíveis: starter, pro, enterprise'
    });
  }

  const plan = planValues[planId];
  
  // Verificar forma de pagamento
  const { creditCard, creditCardHolderInfo, billingType } = req.body;
  const paymentMethod = billingType || 'PIX';
  
  if (paymentMethod === 'CREDIT_CARD' && (!creditCard || !creditCardHolderInfo)) {
    return res.status(400).json({
      success: false,
      error: 'Para pagamento com cartão de crédito, os dados do cartão e do titular são obrigatórios'
    });
  }

  try {
    // Construir dados da assinatura
    const subscriptionData = {
      customer: customerId,
      billingType: paymentMethod,
      value: plan.value,
      nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Amanhã
      cycle: 'MONTHLY',
      description: plan.name,
      externalReference: planId,
      successUrl: `${FRONTEND_URL}/minha-conta/assinatura?status=success`,
      autoRetry: true,
      fine: {
        value: 1,
        type: 'PERCENTAGE'
      },
      interest: {
        value: 2,
        type: 'PERCENTAGE'
      }
    };

    // Adicionar dados do cartão se for pagamento com cartão de crédito
    if (paymentMethod === 'CREDIT_CARD') {
      subscriptionData.creditCard = creditCard;
      subscriptionData.creditCardHolderInfo = creditCardHolderInfo;
    }

    // Logging para debug
    console.log('Criando assinatura com os dados:', JSON.stringify(subscriptionData, null, 2));

    // Fazer requisição para API do Asaas
    const response = await axios.post(
      `${ASAAS_API_URL}/subscriptions`,
      subscriptionData,
      { headers: asaasHeaders }
    );

    // Verificar se a assinatura foi criada com sucesso
    if (response.data && response.data.id) {
      const subscriptionId = response.data.id;
      let result = {
        success: true,
        subscriptionId: subscriptionId,
        subscription: response.data
      };

      // Se for PIX, obter o QR code para pagamento
      if (paymentMethod === 'PIX') {
        try {
          // Obter o primeiro pagamento pendente da assinatura
          const paymentsResponse = await axios.get(
            `${ASAAS_API_URL}/payments?subscription=${subscriptionId}&status=PENDING`,
            { headers: asaasHeaders }
          );

          if (paymentsResponse.data && paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
            const paymentId = paymentsResponse.data.data[0].id;
            
            // Obter o QR code do pagamento PIX
            const pixResponse = await axios.get(
              `${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`,
              { headers: asaasHeaders }
            );

            if (pixResponse.data && pixResponse.data.encodedImage) {
              result.pixInfo = {
                encodedImage: pixResponse.data.encodedImage,
                payload: pixResponse.data.payload,
                expirationDate: pixResponse.data.expirationDate
              };
            }
          }
        } catch (pixError) {
          console.error('Erro ao obter QR code PIX:', pixError);
          result.pixError = 'Erro ao gerar QR code PIX';
        }
      }

      return res.status(201).json(result);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Erro ao criar assinatura',
        response: response.data
      });
    }
  } catch (error) {
    console.error('Erro ao criar assinatura:', error.response ? error.response.data : error.message);
    
    return res.status(error.response ? error.response.status : 500).json({
      success: false,
      error: 'Erro ao criar assinatura',
      message: error.response ? error.response.data : error.message
    });
  }
}

/**
 * Buscar dados de uma assinatura (antigo asaas-find-subscription)
 */
async function findSubscription(req, res) {
  // Verificar se é uma solicitação GET
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use GET ou POST para buscar assinatura.'
    });
  }

  // Obter parâmetros da query ou body
  const subscriptionId = req.query.subscriptionId || (req.body && req.body.subscriptionId);
  const customerId = req.query.customerId || (req.body && req.body.customerId);
  
  // Validar parâmetros
  if (!subscriptionId && !customerId) {
    return res.status(400).json({
      success: false,
      error: 'Forneça subscriptionId ou customerId para buscar a assinatura'
    });
  }

  try {
    let subscriptionData;
    let payments;
    
    // Buscar assinatura por ID
    if (subscriptionId) {
      const subscriptionResponse = await axios.get(
        `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
        { headers: asaasHeaders }
      );
      
      subscriptionData = subscriptionResponse.data;
      
      // Buscar pagamentos da assinatura
      const paymentsResponse = await axios.get(
        `${ASAAS_API_URL}/payments?subscription=${subscriptionId}`,
        { headers: asaasHeaders }
      );
      
      payments = paymentsResponse.data.data;
    } 
    // Buscar assinaturas do cliente
    else if (customerId) {
      const subscriptionsResponse = await axios.get(
        `${ASAAS_API_URL}/subscriptions?customer=${customerId}&limit=100`,
        { headers: asaasHeaders }
      );
      
      const subscriptions = subscriptionsResponse.data.data;
      
      // Verificar se o cliente tem assinaturas
      if (subscriptions && subscriptions.length > 0) {
        // Pegar a assinatura mais recente
        subscriptionData = subscriptions[0];
        
        // Buscar pagamentos da assinatura
        const paymentsResponse = await axios.get(
          `${ASAAS_API_URL}/payments?subscription=${subscriptionData.id}`,
          { headers: asaasHeaders }
        );
        
        payments = paymentsResponse.data.data;
      } else {
        return res.status(404).json({
          success: false,
          error: 'Nenhuma assinatura encontrada para este cliente'
        });
      }
    }

    // Formatar resposta
    return res.status(200).json({
      success: true,
      subscription: subscriptionData,
      payments: payments
    });
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error.response ? error.response.data : error.message);
    
    // Verificar se o erro é 404 (não encontrado)
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Assinatura não encontrada'
      });
    }
    
    return res.status(error.response ? error.response.status : 500).json({
      success: false,
      error: 'Erro ao buscar assinatura',
      message: error.response ? error.response.data : error.message
    });
  }
}

/**
 * Cancelar uma assinatura (antigo asaas-cancel-subscription)
 */
async function cancelSubscription(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST ou DELETE para cancelar assinatura.'
    });
  }

  // Validar campos obrigatórios
  const subscriptionId = req.query.subscriptionId || (req.body && req.body.subscriptionId);
  
  if (!subscriptionId) {
    return res.status(400).json({
      success: false,
      error: 'ID da assinatura (subscriptionId) é obrigatório'
    });
  }

  try {
    // Fazer requisição para API do Asaas
    const response = await axios.delete(
      `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
      { headers: asaasHeaders }
    );

    // Verificar se a resposta foi bem-sucedida
    if (response.data && response.data.deleted) {
      return res.status(200).json({
        success: true,
        message: 'Assinatura cancelada com sucesso',
        deleted: true
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Erro ao cancelar assinatura',
        response: response.data
      });
    }
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error.response ? error.response.data : error.message);
    
    return res.status(error.response ? error.response.status : 500).json({
      success: false,
      error: 'Erro ao cancelar assinatura',
      message: error.response ? error.response.data : error.message
    });
  }
}

/**
 * Atualizar uma assinatura
 */
async function updateSubscription(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST ou PUT para atualizar assinatura.'
    });
  }

  // Validar campos obrigatórios
  const subscriptionId = req.query.subscriptionId || (req.body && req.body.subscriptionId);
  
  if (!subscriptionId) {
    return res.status(400).json({
      success: false,
      error: 'ID da assinatura (subscriptionId) é obrigatório'
    });
  }

  // Preparar dados da atualização
  const updateData = { ...req.body };
  
  // Remover campos que não são da API
  delete updateData.subscriptionId;
  delete updateData.operation;

  try {
    // Fazer requisição para API do Asaas
    const response = await axios.post(
      `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
      updateData,
      { headers: asaasHeaders }
    );

    // Verificar se a atualização foi bem-sucedida
    if (response.data && response.data.id) {
      return res.status(200).json({
        success: true,
        subscription: response.data
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Erro ao atualizar assinatura',
        response: response.data
      });
    }
  } catch (error) {
    console.error('Erro ao atualizar assinatura:', error.response ? error.response.data : error.message);
    
    return res.status(error.response ? error.response.status : 500).json({
      success: false,
      error: 'Erro ao atualizar assinatura',
      message: error.response ? error.response.data : error.message
    });
  }
}

/**
 * Alterar forma de pagamento de uma assinatura
 */
async function changePaymentMethod(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST para alterar forma de pagamento.'
    });
  }

  // Validar campos obrigatórios
  const { subscriptionId, billingType } = req.body;
  
  if (!subscriptionId) {
    return res.status(400).json({
      success: false,
      error: 'ID da assinatura (subscriptionId) é obrigatório'
    });
  }
  
  if (!billingType) {
    return res.status(400).json({
      success: false,
      error: 'Tipo de cobrança (billingType) é obrigatório'
    });
  }

  // Verificar se o billingType é válido
  if (!['BOLETO', 'CREDIT_CARD', 'PIX'].includes(billingType)) {
    return res.status(400).json({
      success: false,
      error: 'Tipo de cobrança inválido. Opções válidas: BOLETO, CREDIT_CARD, PIX'
    });
  }

  // Verificar dados do cartão se for pagamento com cartão de crédito
  if (billingType === 'CREDIT_CARD') {
    const { creditCard, creditCardHolderInfo } = req.body;
    
    if (!creditCard || !creditCardHolderInfo) {
      return res.status(400).json({
        success: false,
        error: 'Para pagamento com cartão de crédito, os dados do cartão e do titular são obrigatórios'
      });
    }
  }

  try {
    // Preparar dados da atualização
    const updateData = {
      billingType: billingType
    };
    
    // Adicionar dados do cartão se for pagamento com cartão de crédito
    if (billingType === 'CREDIT_CARD') {
      updateData.creditCard = req.body.creditCard;
      updateData.creditCardHolderInfo = req.body.creditCardHolderInfo;
    }

    // Fazer requisição para API do Asaas
    const response = await axios.post(
      `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
      updateData,
      { headers: asaasHeaders }
    );

    // Verificar se a atualização foi bem-sucedida
    if (response.data && response.data.id) {
      let result = {
        success: true,
        subscription: response.data
      };

      // Se for PIX, obter o QR code para pagamento do próximo pagamento
      if (billingType === 'PIX') {
        try {
          // Obter o próximo pagamento pendente da assinatura
          const paymentsResponse = await axios.get(
            `${ASAAS_API_URL}/payments?subscription=${subscriptionId}&status=PENDING`,
            { headers: asaasHeaders }
          );

          if (paymentsResponse.data && paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
            const paymentId = paymentsResponse.data.data[0].id;
            
            // Obter o QR code do pagamento PIX
            const pixResponse = await axios.get(
              `${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`,
              { headers: asaasHeaders }
            );

            if (pixResponse.data && pixResponse.data.encodedImage) {
              result.pixInfo = {
                encodedImage: pixResponse.data.encodedImage,
                payload: pixResponse.data.payload,
                expirationDate: pixResponse.data.expirationDate
              };
            }
          }
        } catch (pixError) {
          console.error('Erro ao obter QR code PIX:', pixError);
          result.pixError = 'Erro ao gerar QR code PIX';
        }
      }

      return res.status(200).json(result);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Erro ao alterar forma de pagamento',
        response: response.data
      });
    }
  } catch (error) {
    console.error('Erro ao alterar forma de pagamento:', error.response ? error.response.data : error.message);
    
    return res.status(error.response ? error.response.status : 500).json({
      success: false,
      error: 'Erro ao alterar forma de pagamento',
      message: error.response ? error.response.data : error.message
    });
  }
}

/**
 * Listar assinaturas de um cliente
 */
async function listSubscriptions(req, res) {
  // Verificar método HTTP
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use GET ou POST para listar assinaturas.'
    });
  }

  // Validar campos obrigatórios
  const customerId = req.query.customerId || (req.body && req.body.customerId);
  
  if (!customerId) {
    return res.status(400).json({
      success: false,
      error: 'ID do cliente (customerId) é obrigatório'
    });
  }

  try {
    // Fazer requisição para API do Asaas
    const response = await axios.get(
      `${ASAAS_API_URL}/subscriptions?customer=${customerId}&limit=100`,
      { headers: asaasHeaders }
    );

    // Verificar se a resposta foi bem-sucedida
    if (response.data && response.data.data) {
      const subscriptions = response.data.data;
      
      // Buscar pagamentos para cada assinatura
      const subscriptionsWithPayments = await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            const paymentsResponse = await axios.get(
              `${ASAAS_API_URL}/payments?subscription=${subscription.id}`,
              { headers: asaasHeaders }
            );
            
            return {
              ...subscription,
              payments: paymentsResponse.data.data || []
            };
          } catch (error) {
            console.error(`Erro ao buscar pagamentos da assinatura ${subscription.id}:`, error);
            
            return {
              ...subscription,
              payments: [],
              paymentsError: 'Erro ao buscar pagamentos'
            };
          }
        })
      );
      
      return res.status(200).json({
        success: true,
        subscriptions: subscriptionsWithPayments,
        total: response.data.totalCount || subscriptions.length
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Erro ao listar assinaturas',
        response: response.data
      });
    }
  } catch (error) {
    console.error('Erro ao listar assinaturas:', error.response ? error.response.data : error.message);
    
    return res.status(error.response ? error.response.status : 500).json({
      success: false,
      error: 'Erro ao listar assinaturas',
      message: error.response ? error.response.data : error.message
    });
  }
} 