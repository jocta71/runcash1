/**
 * Endpoint unificado para operações com a API do Asaas
 * Combina várias funções em uma única para economizar funções serverless
 * 
 * Operações suportadas:
 * - find-customer: Buscar cliente por ID
 * - create-customer: Criar novo cliente
 * - find-subscription: Buscar assinatura por ID ou cliente
 * - create-subscription: Criar nova assinatura
 * - cancel-subscription: Cancelar assinatura
 * - find-payment: Buscar pagamento por ID
 * - pix-qrcode: Gerar QRCode PIX
 * - regenerate-pix: Regenerar QR code PIX para um pagamento existente
 */
const axios = require('axios');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PATCH,DELETE,PUT');
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

  // Configuração da API do Asaas
  const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
  const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
  const API_URL = ASAAS_ENVIRONMENT === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  if (!ASAAS_API_KEY) {
    return res.status(500).json({ 
      success: false,
      error: 'Chave de API do Asaas não configurada' 
    });
  }

  // Configuração do cliente HTTP
  const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
      'access_token': ASAAS_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  // Executar a operação correspondente
  try {
    switch (operation) {
      case 'find-customer':
        return await findCustomer(req, res, apiClient);
      
      case 'create-customer':
        return await createCustomer(req, res, apiClient);
      
      case 'find-subscription':
        return await findSubscription(req, res, apiClient);
      
      case 'create-subscription':
        return await createSubscription(req, res, apiClient);
      
      case 'cancel-subscription':
        return await cancelSubscription(req, res, apiClient);
      
      case 'find-payment':
        return await findPayment(req, res, apiClient);
      
      case 'pix-qrcode':
        return await pixQrcode(req, res, apiClient);
      
      case 'regenerate-pix':
        return await regeneratePixCode(req, res, apiClient);
      
      default:
        return res.status(400).json({
          success: false,
          error: `Operação "${operation}" não suportada.`
        });
    }
  } catch (error) {
    console.error(`Erro na operação ${operation}:`, error);
    
    // Verificar se o erro é da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({
      success: false,
      error: `Erro ao executar operação "${operation}"`,
      message: error.message
    });
  }
};

/**
 * Buscar cliente por ID
 */
async function findCustomer(req, res, apiClient) {
  const { customerId } = req.query;
  
  if (!customerId) {
    return res.status(400).json({ 
      success: false,
      error: 'É necessário informar customerId' 
    });
  }

  const response = await apiClient.get(`/customers/${customerId}`);
  
  return res.status(200).json({
    success: true,
    id: response.data.id,
    name: response.data.name,
    email: response.data.email,
    mobilePhone: response.data.mobilePhone,
    cpfCnpj: response.data.cpfCnpj,
    createdAt: response.data.dateCreated
  });
}

/**
 * Criar novo cliente
 */
async function createCustomer(req, res, apiClient) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido. Use POST para criar cliente.' 
    });
  }
  
  // Validar campos obrigatórios
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ 
      success: false,
      error: 'Os campos "name" e "email" são obrigatórios' 
    });
  }

  // Construir objeto de cliente
  const customerData = {
    name: name,
    email: email
  };

  // Adicionar campos opcionais
  if (req.body.cpfCnpj) customerData.cpfCnpj = req.body.cpfCnpj;
  if (req.body.mobilePhone) customerData.mobilePhone = req.body.mobilePhone;
  if (req.body.externalReference) customerData.externalReference = req.body.externalReference;
  
  // Criar cliente no Asaas
  const response = await apiClient.post('/customers', customerData);
  
  return res.status(201).json({
    success: true,
    id: response.data.id,
    name: response.data.name,
    email: response.data.email
  });
}

/**
 * Buscar assinatura por ID ou cliente
 */
async function findSubscription(req, res, apiClient) {
  const { subscriptionId, customerId } = req.query;

  // Validar campos obrigatórios
  if (!subscriptionId && !customerId) {
    return res.status(400).json({ 
      success: false,
      error: 'É necessário informar subscriptionId ou customerId' 
    });
  }

  let subscriptionsData = [];
  let payments = [];

  // Buscar assinatura específica ou lista de assinaturas
  if (subscriptionId) {
    console.log(`Buscando assinatura específica: ${subscriptionId}`);
    const subscriptionResponse = await apiClient.get(`/subscriptions/${subscriptionId}`);
    subscriptionsData = [subscriptionResponse.data];
    
    // Buscar pagamentos associados à assinatura
    try {
      const paymentsResponse = await apiClient.get('/payments', {
        params: { subscription: subscriptionId }
      });
      
      payments = paymentsResponse.data.data || [];
    } catch (paymentsError) {
      console.error('Erro ao buscar pagamentos da assinatura:', paymentsError.message);
    }
  } else if (customerId) {
    console.log(`Buscando assinaturas do cliente: ${customerId}`);
    const subscriptionsResponse = await apiClient.get('/subscriptions', {
      params: { customer: customerId }
    });
    subscriptionsData = subscriptionsResponse.data.data || [];
  }

  // Formatar resposta
  const formattedSubscriptions = subscriptionsData.map(subscription => ({
    id: subscription.id,
    customer: subscription.customer,
    status: subscription.status,
    value: subscription.value,
    nextDueDate: subscription.nextDueDate,
    cycle: subscription.cycle,
    billingType: subscription.billingType,
    description: subscription.description,
    createdDate: subscription.dateCreated
  }));

  // Formatar pagamentos, se disponíveis
  const formattedPayments = payments.map(payment => ({
    id: payment.id,
    status: payment.status,
    value: payment.value,
    dueDate: payment.dueDate,
    billingType: payment.billingType,
    invoiceUrl: payment.invoiceUrl
  }));

  return res.status(200).json({
    success: true,
    subscriptions: formattedSubscriptions,
    payments: formattedPayments.length > 0 ? formattedPayments : undefined
  });
}

/**
 * Criar nova assinatura
 */
async function createSubscription(req, res, apiClient) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido. Use POST para criar assinatura.' 
    });
  }
  
  // Obter dados do corpo da requisição
  const { 
    planId, 
    userId, 
    customerId,
    paymentMethod = 'PIX'
  } = req.body;
  
  // Validar campos obrigatórios
  if (!customerId || !planId) {
    return res.status(400).json({ 
      success: false,
      error: 'Os campos "customerId" e "planId" são obrigatórios' 
    });
  }

  // Determinar valor da assinatura com base no plano
  let value = 0;
  let cycle = 'MONTHLY'; // Padrão
  let description = '';
  
  // Definir valores dos planos
  switch (planId) {
    case 'basic':
      value = 19.90;
      description = 'Plano Básico';
      break;
    case 'pro':
      value = 49.90;
      description = 'Plano Profissional';
      break;
    case 'premium':
      value = 99.90;
      description = 'Plano Premium';
      break;
    case 'free':
      // Plano gratuito
      return res.status(200).json({
        success: true,
        message: 'Plano gratuito ativado',
        status: 'ACTIVE',
        planId: 'free'
      });
    default:
      return res.status(400).json({
        success: false,
        error: `Plano "${planId}" não reconhecido`
      });
  }

  // Construir objeto de assinatura
  const subscriptionData = {
    customer: customerId,
    billingType: paymentMethod,
    value: value,
    cycle: cycle,
    description: description,
    nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Amanhã
  };

  // Adicionar campos específicos de cartão de crédito se necessário
  if (paymentMethod === 'CREDIT_CARD' && req.body.creditCardToken) {
    subscriptionData.creditCardToken = req.body.creditCardToken;
    subscriptionData.creditCard = {
      holderName: req.body.creditCardHolderName,
      number: req.body.creditCardNumber,
      expiryMonth: req.body.creditCardExpiryMonth,
      expiryYear: req.body.creditCardExpiryYear,
      ccv: req.body.creditCardCcv
    };
  }

  // Criar assinatura no Asaas
  const response = await apiClient.post('/subscriptions', subscriptionData);
  
  // Se for PIX, obter QR Code para o primeiro pagamento
  let paymentData = null;
  let pixInfo = null;
  
  if (paymentMethod === 'PIX' && response.data.id) {
    try {
      // Obter o primeiro pagamento da assinatura
      const paymentsResponse = await apiClient.get('/payments', {
        params: { subscription: response.data.id }
      });
      
      if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
        const firstPayment = paymentsResponse.data.data[0];
        paymentData = firstPayment;
        
        // Obter QR Code PIX
        const pixResponse = await apiClient.get(`/payments/${firstPayment.id}/pixQrCode`);
        pixInfo = pixResponse.data;
      }
    } catch (error) {
      console.error('Erro ao obter informações PIX:', error);
    }
  }
  
  return res.status(201).json({
    success: true,
    subscriptionId: response.data.id,
    customerId: response.data.customer,
    value: response.data.value,
    status: response.data.status,
    paymentId: paymentData?.id,
    encodedImage: pixInfo?.encodedImage,
    payload: pixInfo?.payload,
    expirationDate: pixInfo?.expirationDate
  });
}

/**
 * Cancelar assinatura
 */
async function cancelSubscription(req, res, apiClient) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido. Use POST para cancelar assinatura.' 
    });
  }
  
  // Obter dados do corpo da requisição
  const { subscriptionId } = req.body;
  
  // Validar campos obrigatórios
  if (!subscriptionId) {
    return res.status(400).json({ 
      success: false,
      error: 'O campo "subscriptionId" é obrigatório' 
    });
  }

  // Cancelar assinatura no Asaas
  const response = await apiClient.delete(`/subscriptions/${subscriptionId}`);
  
  return res.status(200).json({
    success: true,
    message: 'Assinatura cancelada com sucesso',
    subscriptionId
  });
}

/**
 * Buscar pagamento por ID
 */
async function findPayment(req, res, apiClient) {
  const { paymentId } = req.query;
  
  if (!paymentId) {
    return res.status(400).json({ 
      success: false,
      error: 'É necessário informar paymentId' 
    });
  }

  const response = await apiClient.get(`/payments/${paymentId}`);
  
  return res.status(200).json({
    success: true,
    id: response.data.id,
    status: response.data.status,
    value: response.data.value,
    netValue: response.data.netValue,
    dueDate: response.data.dueDate,
    paymentDate: response.data.paymentDate,
    billingType: response.data.billingType,
    invoiceUrl: response.data.invoiceUrl,
    externalReference: response.data.externalReference
  });
}

/**
 * Gerar QRCode PIX
 */
async function pixQrcode(req, res, apiClient) {
  const { paymentId } = req.query;
  
  if (!paymentId) {
    return res.status(400).json({ 
      success: false,
      error: 'É necessário informar paymentId' 
    });
  }

  const response = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
  
  return res.status(200).json({
    success: true,
    encodedImage: response.data.encodedImage,
    payload: response.data.payload,
    expirationDate: response.data.expirationDate
  });
}

/**
 * Regenerar QR code PIX para um pagamento existente
 */
async function regeneratePixCode(req, res, apiClient) {
  // Aceitar solicitações GET e POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido. Use GET ou POST para regenerar QR code PIX.' 
    });
  }
  
  try {
    // Obter paymentId ou subscriptionId da query ou body
    let paymentId = null;
    let subscriptionId = null;
    
    if (req.method === 'GET') {
      paymentId = req.query.paymentId;
      subscriptionId = req.query.subscriptionId;
    } else {
      paymentId = req.body.paymentId;
      subscriptionId = req.body.subscriptionId;
    }

    // Precisamos de pelo menos um dos IDs
    if (!paymentId && !subscriptionId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar paymentId ou subscriptionId' 
      });
    }

    // Se temos apenas o subscriptionId, precisamos buscar o paymentId
    if (!paymentId && subscriptionId) {
      console.log(`Buscando pagamento para assinatura ${subscriptionId}...`);
      
      try {
        const paymentsResponse = await apiClient.get('/payments', {
          params: { subscription: subscriptionId }
        });
        
        if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
          // Pegar o pagamento mais recente
          paymentId = paymentsResponse.data.data[0].id;
          console.log(`Pagamento encontrado: ${paymentId}`);
        } else {
          return res.status(404).json({
            success: false,
            error: 'Nenhum pagamento encontrado para esta assinatura'
          });
        }
      } catch (searchError) {
        console.error('Erro ao buscar pagamento:', searchError.message);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar pagamento',
          details: searchError.message
        });
      }
    }

    // Agora que temos o paymentId, buscar informações do pagamento
    console.log(`Verificando se o pagamento ${paymentId} é do tipo PIX...`);
    
    let payment;
    try {
      const paymentResponse = await apiClient.get(`/payments/${paymentId}`);
      payment = paymentResponse.data;
      
      if (payment.billingType !== 'PIX') {
        return res.status(400).json({
          success: false,
          error: 'Este pagamento não é do tipo PIX'
        });
      }
      
      if (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED') {
        return res.status(400).json({
          success: false,
          error: 'Este pagamento já foi confirmado'
        });
      }
      
      console.log(`Pagamento PIX válido. Status: ${payment.status}`);
    } catch (paymentError) {
      console.error('Erro ao verificar pagamento:', paymentError.message);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar pagamento',
        details: paymentError.message
      });
    }
    
    // Gerar QR Code PIX
    console.log(`Gerando QR Code PIX para o pagamento ${paymentId}...`);
    
    try {
      const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
      
      console.log('QR Code PIX gerado com sucesso!');
      
      // Retornar QR Code e informações do pagamento
      return res.status(200).json({
        success: true,
        payment: {
          id: payment.id,
          value: payment.value,
          status: payment.status,
          dueDate: payment.dueDate,
          description: payment.description
        },
        qrCode: {
          encodedImage: pixResponse.data.encodedImage,
          payload: pixResponse.data.payload,
          expirationDate: pixResponse.data.expirationDate
        }
      });
    } catch (pixError) {
      console.error('Erro ao gerar QR Code PIX:', pixError.message);
      
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar QR Code PIX',
        details: pixError.message
      });
    }
  } catch (error) {
    console.error('Erro inesperado:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Erro inesperado',
      message: error.message
    });
  }
} 