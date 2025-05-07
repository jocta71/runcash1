const express = require('express');
const axios = require('axios');
const router = express.Router();

// Configuração da API do Asaas
const getAsaasConfig = () => {
  const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
  const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
  const API_URL = ASAAS_ENVIRONMENT === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  if (!ASAAS_API_KEY) {
    throw new Error('Chave de API do Asaas não configurada');
  }

  // Configuração do cliente HTTP
  const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
      'access_token': ASAAS_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return { apiClient, API_URL };
};

// Middleware para CORS
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// ------------------- ENCONTRAR CLIENTE ------------------- //
router.get('/find-customer', async (req, res) => {
  try {
    const { customerId, cpfCnpj, email } = req.query;

    // Validar campos obrigatórios
    if (!customerId && !cpfCnpj && !email) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar customerId, cpfCnpj ou email' 
      });
    }

    const { apiClient } = getAsaasConfig();

    let customer = null;
    let subscriptions = [];

    // Buscar cliente por ID, CPF/CNPJ ou email
    if (customerId) {
      console.log(`Buscando cliente por ID: ${customerId}`);
      const customerResponse = await apiClient.get(`/customers/${customerId}`);
      customer = customerResponse.data;
    } else if (cpfCnpj || email) {
      console.log(`Buscando cliente por ${cpfCnpj ? 'CPF/CNPJ' : 'email'}: ${cpfCnpj || email}`);
      const searchParams = cpfCnpj ? { cpfCnpj } : { email };
      
      const customersResponse = await apiClient.get('/customers', {
        params: searchParams
      });
      
      if (customersResponse.data.data && customersResponse.data.data.length > 0) {
        customer = customersResponse.data.data[0];
      } else {
        return res.status(404).json({
          success: false,
          error: 'Cliente não encontrado'
        });
      }
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    // Buscar assinaturas do cliente
    try {
      console.log(`Buscando assinaturas do cliente: ${customer.id}`);
      const subscriptionsResponse = await apiClient.get('/subscriptions', {
        params: { customer: customer.id }
      });
      
      subscriptions = subscriptionsResponse.data.data || [];
    } catch (subscriptionsError) {
      console.error('Erro ao buscar assinaturas:', subscriptionsError.message);
    }

    // Formatar cliente
    const formattedCustomer = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      cpfCnpj: customer.cpfCnpj,
      mobilePhone: customer.mobilePhone,
      address: customer.address,
      addressNumber: customer.addressNumber,
      complement: customer.complement,
      province: customer.province,
      postalCode: customer.postalCode,
      externalReference: customer.externalReference,
      notificationDisabled: customer.notificationDisabled,
      createdAt: customer.dateCreated
    };

    // Formatar assinaturas
    const formattedSubscriptions = subscriptions.map(subscription => ({
      id: subscription.id,
      value: subscription.value,
      cycle: subscription.cycle,
      nextDueDate: subscription.nextDueDate,
      billingType: subscription.billingType,
      status: subscription.status,
      description: subscription.description
    }));

    return res.status(200).json({
      success: true,
      customer: formattedCustomer,
      subscriptions: formattedSubscriptions
    });
  } catch (error) {
    console.error('Erro ao buscar cliente:', error.message);
    
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
      error: 'Erro ao buscar cliente',
      message: error.message
    });
  }
});

// ------------------- CRIAR CLIENTE ------------------- //
router.post('/create-customer', async (req, res) => {
  try {
    // Validar campos obrigatórios
    const { name, email, cpfCnpj, mobilePhone } = req.body;

    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios não informados: nome, email e CPF/CNPJ são necessários'
      });
    }

    const { apiClient } = getAsaasConfig();

    // Verificar se o cliente já existe
    console.log(`Verificando se o cliente já existe: ${cpfCnpj}`);
    const existingCustomerResponse = await apiClient.get('/customers', {
      params: { cpfCnpj }
    });

    if (existingCustomerResponse.data.data && existingCustomerResponse.data.data.length > 0) {
      // Cliente já existe
      const existingCustomer = existingCustomerResponse.data.data[0];
      console.log(`Cliente já existe: ${existingCustomer.id}`);

      return res.status(200).json({
        success: true,
        message: 'Cliente já existe',
        customer: {
          id: existingCustomer.id,
          name: existingCustomer.name,
          email: existingCustomer.email,
          cpfCnpj: existingCustomer.cpfCnpj,
          mobilePhone: existingCustomer.mobilePhone,
          externalReference: existingCustomer.externalReference,
          createdAt: existingCustomer.dateCreated
        }
      });
    }

    // Criar novo cliente
    console.log('Criando novo cliente');
    const newCustomerData = {
      name,
      email,
      cpfCnpj,
      mobilePhone,
      ...req.body // Outros campos como endereço, etc.
    };

    const createCustomerResponse = await apiClient.post('/customers', newCustomerData);
    const createdCustomer = createCustomerResponse.data;
    console.log(`Cliente criado com sucesso: ${createdCustomer.id}`);

    return res.status(201).json({
      success: true,
      message: 'Cliente criado com sucesso',
      customer: {
        id: createdCustomer.id,
        name: createdCustomer.name,
        email: createdCustomer.email,
        cpfCnpj: createdCustomer.cpfCnpj,
        mobilePhone: createdCustomer.mobilePhone,
        externalReference: createdCustomer.externalReference,
        createdAt: createdCustomer.dateCreated
      }
    });

  } catch (error) {
    console.error('Erro ao criar cliente:', error.message);
    
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
      error: 'Erro ao criar cliente',
      message: error.message
    });
  }
});

// ------------------- ENCONTRAR PAGAMENTO ------------------- //
router.get('/find-payment', async (req, res) => {
  try {
    const { paymentId } = req.query;

    // Validar campos obrigatórios
    if (!paymentId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar o ID do pagamento' 
      });
    }

    const { apiClient } = getAsaasConfig();

    // Buscar pagamento por ID
    console.log(`Buscando pagamento por ID: ${paymentId}`);
    const paymentResponse = await apiClient.get(`/payments/${paymentId}`);
    const payment = paymentResponse.data;

    return res.status(200).json({
      success: true,
      payment: {
        id: payment.id,
        customer: payment.customer,
        value: payment.value,
        netValue: payment.netValue,
        status: payment.status,
        dueDate: payment.dueDate,
        paymentDate: payment.paymentDate,
        billingType: payment.billingType,
        invoiceUrl: payment.invoiceUrl,
        description: payment.description,
        externalReference: payment.externalReference,
        confirmedDate: payment.confirmedDate,
        originalValue: payment.originalValue,
        interestValue: payment.interestValue,
        originalDueDate: payment.originalDueDate,
        paymentLink: payment.paymentLink
      }
    });
  } catch (error) {
    console.error('Erro ao buscar pagamento:', error.message);
    
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
      error: 'Erro ao buscar pagamento',
      message: error.message
    });
  }
});

// ------------------- ENCONTRAR ASSINATURA ------------------- //
router.get('/find-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.query;

    // Validar campos obrigatórios
    if (!subscriptionId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar o ID da assinatura' 
      });
    }

    const { apiClient } = getAsaasConfig();

    // Buscar assinatura por ID
    console.log(`Buscando assinatura por ID: ${subscriptionId}`);
    const subscriptionResponse = await apiClient.get(`/subscriptions/${subscriptionId}`);
    const subscription = subscriptionResponse.data;

    // Buscar pagamentos da assinatura
    console.log(`Buscando pagamentos da assinatura: ${subscriptionId}`);
    const paymentsResponse = await apiClient.get('/payments', {
      params: { subscription: subscriptionId }
    });
    
    const payments = paymentsResponse.data.data || [];

    // Formatar pagamentos
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      value: payment.value,
      netValue: payment.netValue,
      status: payment.status,
      dueDate: payment.dueDate,
      paymentDate: payment.paymentDate,
      billingType: payment.billingType,
      invoiceUrl: payment.invoiceUrl,
      paymentLink: payment.paymentLink
    }));

    return res.status(200).json({
      success: true,
      subscription: {
        id: subscription.id,
        customer: subscription.customer,
        value: subscription.value,
        cycle: subscription.cycle,
        nextDueDate: subscription.nextDueDate,
        billingType: subscription.billingType,
        status: subscription.status,
        description: subscription.description
      },
      payments: formattedPayments
    });
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error.message);
    
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
      error: 'Erro ao buscar assinatura',
      message: error.message
    });
  }
});

// ------------------- CRIAR ASSINATURA ------------------- //
router.post('/create-subscription', async (req, res) => {
  try {
    // Validar campos obrigatórios
    const { customerId, value, cycle, billingType, nextDueDate, description } = req.body;

    if (!customerId || !value || !cycle || !billingType || !nextDueDate) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios não informados: customerId, value, cycle, billingType e nextDueDate são necessários'
      });
    }

    const { apiClient } = getAsaasConfig();

    // Verificar se o cliente existe
    console.log(`Verificando se o cliente existe: ${customerId}`);
    try {
      await apiClient.get(`/customers/${customerId}`);
    } catch (customerError) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado',
        details: customerError.response?.data || customerError.message
      });
    }

    // Criar nova assinatura
    console.log('Criando nova assinatura');
    const subscriptionData = {
      customer: customerId,
      value,
      cycle,
      billingType,
      nextDueDate,
      description: description || 'Assinatura RunCash',
      ...req.body // Outros campos
    };

    const subscriptionResponse = await apiClient.post('/subscriptions', subscriptionData);
    const subscription = subscriptionResponse.data;
    console.log(`Assinatura criada com sucesso: ${subscription.id}`);

    return res.status(201).json({
      success: true,
      message: 'Assinatura criada com sucesso',
      subscription: {
        id: subscription.id,
        customer: subscription.customer,
        value: subscription.value,
        cycle: subscription.cycle,
        nextDueDate: subscription.nextDueDate,
        billingType: subscription.billingType,
        status: subscription.status,
        description: subscription.description
      }
    });
  } catch (error) {
    console.error('Erro ao criar assinatura:', error.message);
    
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
      error: 'Erro ao criar assinatura',
      message: error.message
    });
  }
});

// ------------------- CANCELAR ASSINATURA ------------------- //
router.post('/cancel-subscription', async (req, res) => {
  try {
    // Validar campos obrigatórios
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'É necessário informar o ID da assinatura'
      });
    }

    const { apiClient } = getAsaasConfig();

    // Cancelar assinatura
    console.log(`Cancelando assinatura: ${subscriptionId}`);
    await apiClient.delete(`/subscriptions/${subscriptionId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Assinatura cancelada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error.message);
    
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
      error: 'Erro ao cancelar assinatura',
      message: error.message
    });
  }
});

// ------------------- GERAR QR CODE PIX ------------------- //
router.post('/pix-qrcode', async (req, res) => {
  try {
    // Validar campos obrigatórios
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'É necessário informar o ID do pagamento'
      });
    }

    const { apiClient } = getAsaasConfig();

    // Gerar QR Code PIX
    console.log(`Gerando QR Code PIX para o pagamento: ${paymentId}`);
    const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
    
    if (!pixResponse.data || !pixResponse.data.encodedImage) {
      return res.status(400).json({
        success: false,
        error: 'Erro ao gerar QR Code PIX',
        details: 'O pagamento não possui QR Code PIX gerado'
      });
    }

    return res.status(200).json({
      success: true,
      pix: {
        encodedImage: pixResponse.data.encodedImage,
        payload: pixResponse.data.payload,
        expirationDate: pixResponse.data.expirationDate
      }
    });
  } catch (error) {
    console.error('Erro ao gerar QR Code PIX:', error.message);
    
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
      error: 'Erro ao gerar QR Code PIX',
      message: error.message
    });
  }
});

module.exports = router; 