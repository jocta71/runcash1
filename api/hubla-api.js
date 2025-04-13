const axios = require('axios');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Lidar com requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Obter o tipo de operação da query
  const { operation } = req.query;

  // Se não houver operação especificada, tratar como test-vercel por padrão
  if (!operation) {
    return handleTestVercel(req, res);
  }

  // Obter a chave da API da Hubla
  const apiKey = process.env.HUBLA_API_KEY;
  
  // Verificar se a chave da API está configurada para operações da Hubla
  if (operation !== 'test-vercel' && !apiKey) {
    console.error('HUBLA_API_KEY não está configurada');
    return res.status(500).json({ error: 'Erro de configuração: HUBLA_API_KEY não encontrada' });
  }
  
  // Logar os primeiros caracteres da chave (para depuração) se for uma operação que requer a chave
  if (operation !== 'test-vercel' && apiKey) {
    console.log(`Usando HUBLA_API_KEY: ${apiKey.substring(0, 5)}...`);
  }

  try {
    // Rotear a requisição com base na operação
    switch (operation) {
      case 'test-vercel':
        return handleTestVercel(req, res);
        
      case 'test':
        return handleTest(req, res, apiKey);
      
      case 'create-customer':
        return handleCreateCustomer(req, res, apiKey);
      
      case 'create-subscription':
        return handleCreateSubscription(req, res, apiKey);
        
      case 'subscription-details':
        return handleSubscriptionDetails(req, res, apiKey);
        
      case 'cancel-subscription':
        return handleCancelSubscription(req, res, apiKey);
        
      case 'test-all':
        return handleTestAll(req, res, apiKey);
        
      case 'webhook':
        return handleWebhook(req, res, apiKey);
        
      default:
        return res.status(400).json({ error: `Operação desconhecida: ${operation}` });
    }
  } catch (error) {
    console.error(`Erro no processamento da operação ${operation}:`, error.message);
    return res.status(500).json({ 
      error: 'Erro interno ao processar a requisição',
      details: error.message
    });
  }
};

// Função para teste do Vercel (equivalente ao antigo test.js)
async function handleTestVercel(req, res) {
  // Obter valor da variável de ambiente
  const asaasApiKey = process.env.ASAAS_API_KEY;
  const asaasKeyStatus = asaasApiKey 
    ? `Configurada (primeiros 10 caracteres: ${asaasApiKey.substring(0, 10)}...)` 
    : 'Não configurada';
    
  const hublaApiKey = process.env.HUBLA_API_KEY;
  const hublaKeyStatus = hublaApiKey 
    ? `Configurada (primeiros 5 caracteres: ${hublaApiKey.substring(0, 5)}...)` 
    : 'Não configurada';
  
  return res.status(200).json({
    status: 'success',
    message: 'API funcionando corretamente',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    apis: {
      hubla: hublaKeyStatus,
      asaas: asaasKeyStatus
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      HUBLA_API_KEY_CONFIGURED: !!process.env.HUBLA_API_KEY,
      ASAAS_API_KEY_CONFIGURED: !!process.env.ASAAS_API_KEY
    }
  });
}

// Função para teste simples da API
async function handleTest(req, res, apiKey) {
  // Informações sobre o ambiente
  const environment = {
    NODE_ENV: process.env.NODE_ENV || 'não definido',
    VERCEL_ENV: process.env.VERCEL_ENV || 'não definido',
    VERCEL_URL: process.env.VERCEL_URL || 'não definido',
    VERCEL_REGION: process.env.VERCEL_REGION || 'não definido'
  };

  // Retornar informações sobre a configuração
  return res.status(200).json({
    message: 'Teste de integração com a Hubla',
    timestamp: new Date().toISOString(),
    hubla: {
      apiKey: `Configurada (primeiros 5 caracteres: ${apiKey.substring(0, 5)}...)`
    },
    environment
  });
}

// Função para teste completo da API
async function handleTestAll(req, res, apiKey) {
  // Objeto para armazenar resultados dos testes
  const testResults = {
    timestamp: new Date().toISOString(),
    apiKey: `Configurada (primeiros 5 caracteres: ${apiKey.substring(0, 5)}...)`,
    tests: {}
  };

  // Teste 1: Listar planos (se houver)
  try {
    const plansResponse = await axios.get(
      'https://api.hubla.com.br/v1/plans?limit=5',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extrair informações relevantes dos planos
    const plans = plansResponse.data.data || [];
    testResults.tests.plans = {
      success: true,
      count: plans.length,
      data: plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        value: plan.value
      }))
    };
  } catch (error) {
    testResults.tests.plans = {
      success: false,
      error: error.message,
      details: error.response?.data || 'Erro ao listar planos'
    };
  }

  // Teste 2: Listar clientes (se houver)
  try {
    const customersResponse = await axios.get(
      'https://api.hubla.com.br/v1/customers?limit=5',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extrair informações relevantes dos clientes
    const customers = customersResponse.data.data || [];
    testResults.tests.customers = {
      success: true,
      count: customers.length,
      data: customers.map(customer => ({
        id: customer.id,
        name: customer.name,
        email: customer.email
      }))
    };
  } catch (error) {
    testResults.tests.customers = {
      success: false,
      error: error.message,
      details: error.response?.data || 'Erro ao listar clientes'
    };
  }

  // Teste 3: Listar assinaturas (se houver)
  try {
    const subscriptionsResponse = await axios.get(
      'https://api.hubla.com.br/v1/subscriptions?limit=5',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extrair informações relevantes das assinaturas
    const subscriptions = subscriptionsResponse.data.data || [];
    testResults.tests.subscriptions = {
      success: true,
      count: subscriptions.length,
      data: subscriptions.map(subscription => ({
        id: subscription.id,
        value: subscription.value,
        status: subscription.status,
        customerId: subscription.customer?.id
      }))
    };
  } catch (error) {
    testResults.tests.subscriptions = {
      success: false,
      error: error.message,
      details: error.response?.data || 'Erro ao listar assinaturas'
    };
  }

  // Resumo dos resultados dos testes
  testResults.summary = {
    plansSuccess: testResults.tests.plans?.success || false,
    customersSuccess: testResults.tests.customers?.success || false,
    subscriptionsSuccess: testResults.tests.subscriptions?.success || false,
    message: "Testes concluídos. Verifique cada seção para detalhes."
  };

  return res.status(200).json(testResults);
}

// Função para criar cliente
async function handleCreateCustomer(req, res, apiKey) {
  // Verificar se o método é POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Obter dados do cliente do corpo da requisição
  const { name, email, cpfCnpj, mobilePhone } = req.body;

  // Validar campos obrigatórios
  if (!name || !email || !cpfCnpj) {
    console.error('Dados de cliente incompletos:', { name, email, cpfCnpj });
    return res.status(400).json({ error: 'Dados incompletos: nome, e-mail e CPF/CNPJ são obrigatórios' });
  }

  // Formatar CPF/CNPJ (remover caracteres especiais)
  const formattedCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');

  // Formatar telefone (remover caracteres especiais) se fornecido
  const formattedPhone = mobilePhone ? mobilePhone.replace(/[^\d]/g, '') : undefined;

  // Preparar dados do cliente para a Hubla
  const customerData = {
    name,
    email,
    document: formattedCpfCnpj,
    phone: formattedPhone
  };

  console.log(`Criando cliente na Hubla: ${name} (${email})`);

  try {
    // Fazer requisição para API da Hubla
    const response = await axios.post(
      'https://api.hubla.com.br/v1/customers',
      customerData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Verificar se a requisição foi bem-sucedida
    if (response.status === 200 || response.status === 201) {
      console.log(`Cliente criado/atualizado com sucesso: ${response.data.id}`);
      
      // Retornar o ID do cliente
      return res.status(200).json({ 
        customerId: response.data.id,
        message: 'Cliente criado com sucesso'
      });
    } else {
      console.error('Resposta inesperada da Hubla:', response.status, response.data);
      return res.status(response.status).json({
        error: 'Erro ao criar cliente na Hubla',
        details: response.data
      });
    }
  } catch (error) {
    // Tratar erros de API
    if (error.response) {
      // A requisição foi feita e o servidor respondeu com um status fora do intervalo 2xx
      console.error('Erro na API da Hubla:', error.response.status, error.response.data);
      
      // Verificar se o cliente já existe
      if (error.response.status === 409 && error.response.data && error.response.data.id) {
        // Cliente já existe, retornar o ID existente
        console.log(`Cliente já existe: ${error.response.data.id}`);
        return res.status(200).json({ 
          customerId: error.response.data.id,
          message: 'Cliente já existe na Hubla'
        });
      }
      
      return res.status(error.response.status).json({
        error: 'Erro ao criar cliente na Hubla',
        details: error.response.data
      });
    } else if (error.request) {
      // A requisição foi feita mas nenhuma resposta foi recebida
      console.error('Sem resposta da API da Hubla:', error.request);
      return res.status(500).json({ error: 'Erro de conexão com a API da Hubla' });
    } else {
      // Algo aconteceu na configuração da requisição que causou um erro
      console.error('Erro ao configurar requisição para a Hubla:', error.message);
      return res.status(500).json({ error: 'Erro interno ao criar cliente', details: error.message });
    }
  }
}

// Função para criar assinatura
async function handleCreateSubscription(req, res, apiKey) {
  // Verificar se o método é POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Extrair dados da requisição
    const { 
      customerId, 
      planId, 
      value, 
      cycle, 
      nextDueDate,
      description,
      externalReference
    } = req.body;

    // Validar campos obrigatórios
    if (!customerId || !planId || !value || !cycle || !nextDueDate) {
      console.error('Dados de assinatura incompletos:', req.body);
      return res.status(400).json({ 
        error: 'Dados incompletos', 
        message: 'Os campos customerId, planId, value, cycle e nextDueDate são obrigatórios' 
      });
    }

    console.log(`Criando assinatura para cliente ${customerId}, plano ${planId}`);

    // Preparar dados da assinatura
    const subscriptionData = {
      customer: customerId,
      plan: planId,
      value: value,
      cycle: cycle,  // MONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY
      description: description || `Assinatura ${planId}`,
      nextDueDate: nextDueDate,
      externalReference: externalReference || `sub_${Date.now()}`,
      autoRenewal: true,
      updatePendingPayments: false
    };

    // Criar assinatura na Hubla
    const subscriptionResponse = await axios.post(
      'https://api.hubla.com.br/v1/subscriptions',
      subscriptionData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Verificar se a criação da assinatura foi bem-sucedida
    if (subscriptionResponse.status !== 200 && subscriptionResponse.status !== 201) {
      console.error('Erro ao criar assinatura:', subscriptionResponse.status, subscriptionResponse.data);
      return res.status(subscriptionResponse.status).json({
        error: 'Erro ao criar assinatura na Hubla',
        details: subscriptionResponse.data
      });
    }

    const subscriptionId = subscriptionResponse.data.id;
    console.log(`Assinatura criada com sucesso: ${subscriptionId}`);

    // Obter o link de pagamento
    // 1. Buscar pagamentos pendentes da assinatura
    const paymentsResponse = await axios.get(
      `https://api.hubla.com.br/v1/subscriptions/${subscriptionId}/payments?status=PENDING`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const payments = paymentsResponse.data.data || [];
    
    if (payments.length === 0) {
      console.error('Nenhum pagamento pendente encontrado para a assinatura criada');
      return res.status(200).json({
        subscriptionId: subscriptionId,
        message: 'Assinatura criada, mas nenhum pagamento pendente encontrado'
      });
    }

    // 2. Obter o link de pagamento para o primeiro pagamento pendente
    const paymentId = payments[0].id;
    const paymentLinkResponse = await axios.get(
      `https://api.hubla.com.br/v1/payments/${paymentId}/paymentlink`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const redirectUrl = paymentLinkResponse.data.url;
    console.log(`Link de pagamento gerado: ${redirectUrl}`);

    // Retornar os dados da assinatura e o link de pagamento
    return res.status(200).json({
      subscriptionId: subscriptionId,
      redirectUrl: redirectUrl,
      message: 'Assinatura criada com sucesso'
    });
  } catch (error) {
    // Tratar erros de API
    if (error.response) {
      // A requisição foi feita e o servidor respondeu com um status fora do intervalo 2xx
      console.error('Erro na API da Hubla:', error.response.status, error.response.data);
      return res.status(error.response.status).json({
        error: 'Erro ao criar assinatura',
        details: error.response.data
      });
    } else if (error.request) {
      // A requisição foi feita mas nenhuma resposta foi recebida
      console.error('Sem resposta da API da Hubla:', error.request);
      return res.status(500).json({ error: 'Erro de conexão com a API da Hubla' });
    } else {
      // Algo aconteceu na configuração da requisição que causou um erro
      console.error('Erro ao configurar requisição para a Hubla:', error.message);
      return res.status(500).json({ error: 'Erro interno ao criar assinatura', details: error.message });
    }
  }
}

// Função para obter detalhes da assinatura
async function handleSubscriptionDetails(req, res, apiKey) {
  // Verificar se o método é GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Obter ID da assinatura da query
  const { id } = req.query;

  // Validar parâmetro obrigatório
  if (!id) {
    console.error('ID da assinatura não fornecido');
    return res.status(400).json({ error: 'ID da assinatura é obrigatório' });
  }

  console.log(`Buscando detalhes da assinatura: ${id}`);

  try {
    // Buscar detalhes da assinatura na Hubla
    const subscriptionResponse = await axios.get(
      `https://api.hubla.com.br/v1/subscriptions/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Verificar resposta da API
    if (subscriptionResponse.status !== 200 || !subscriptionResponse.data) {
      console.error('Resposta inválida da API da Hubla:', subscriptionResponse.status);
      return res.status(subscriptionResponse.status).json({
        error: 'Erro ao obter detalhes da assinatura',
        details: subscriptionResponse.data
      });
    }

    const subscription = subscriptionResponse.data;

    // Buscar os pagamentos da assinatura
    const paymentsResponse = await axios.get(
      `https://api.hubla.com.br/v1/subscriptions/${id}/payments`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Combinar dados da assinatura com pagamentos
    const result = {
      subscription: subscription,
      payments: paymentsResponse.status === 200 ? paymentsResponse.data.data || [] : []
    };

    console.log(`Detalhes da assinatura recuperados com sucesso: ${id}`);
    return res.status(200).json(result);
  } catch (error) {
    // Tratar erros de API
    if (error.response) {
      // A requisição foi feita e o servidor respondeu com um status fora do intervalo 2xx
      console.error('Erro na API da Hubla:', error.response.status, error.response.data);
      
      // Se a assinatura não foi encontrada
      if (error.response.status === 404) {
        return res.status(404).json({
          error: 'Assinatura não encontrada',
          details: error.response.data
        });
      }
      
      return res.status(error.response.status).json({
        error: 'Erro ao buscar detalhes da assinatura',
        details: error.response.data
      });
    } else if (error.request) {
      // A requisição foi feita mas nenhuma resposta foi recebida
      console.error('Sem resposta da API da Hubla:', error.request);
      return res.status(500).json({ error: 'Erro de conexão com a API da Hubla' });
    } else {
      // Algo aconteceu na configuração da requisição que causou um erro
      console.error('Erro ao configurar requisição para a Hubla:', error.message);
      return res.status(500).json({ error: 'Erro interno ao buscar detalhes da assinatura', details: error.message });
    }
  }
}

// Função para cancelar assinatura
async function handleCancelSubscription(req, res, apiKey) {
  // Verificar se o método é POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Obter ID da assinatura do corpo da requisição
  const { subscriptionId } = req.body;

  // Validar parâmetro obrigatório
  if (!subscriptionId) {
    console.error('ID da assinatura não fornecido');
    return res.status(400).json({ error: 'ID da assinatura é obrigatório' });
  }

  console.log(`Cancelando assinatura: ${subscriptionId}`);

  try {
    // Fazer requisição para cancelar a assinatura na Hubla
    const response = await axios.delete(
      `https://api.hubla.com.br/v1/subscriptions/${subscriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Verificar resposta da API
    if (response.status === 200 || response.status === 204) {
      console.log(`Assinatura ${subscriptionId} cancelada com sucesso`);
      return res.status(200).json({ 
        success: true,
        message: 'Assinatura cancelada com sucesso'
      });
    } else {
      console.error('Resposta inesperada da API da Hubla:', response.status, response.data);
      return res.status(response.status).json({
        success: false,
        error: 'Erro ao cancelar assinatura na Hubla',
        details: response.data
      });
    }
  } catch (error) {
    // Tratar erros de API
    if (error.response) {
      // A requisição foi feita e o servidor respondeu com um status fora do intervalo 2xx
      console.error('Erro na API da Hubla:', error.response.status, error.response.data);
      
      // Se a assinatura não foi encontrada
      if (error.response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Assinatura não encontrada',
          details: error.response.data
        });
      }
      
      // Se a assinatura já foi cancelada
      if (error.response.status === 400 && 
          error.response.data && 
          (error.response.data.message || '').includes('already')) {
        return res.status(200).json({
          success: true,
          message: 'Assinatura já estava cancelada'
        });
      }
      
      return res.status(error.response.status).json({
        success: false,
        error: 'Erro ao cancelar assinatura',
        details: error.response.data
      });
    } else if (error.request) {
      // A requisição foi feita mas nenhuma resposta foi recebida
      console.error('Sem resposta da API da Hubla:', error.request);
      return res.status(500).json({ 
        success: false,
        error: 'Erro de conexão com a API da Hubla'
      });
    } else {
      // Algo aconteceu na configuração da requisição que causou um erro
      console.error('Erro ao configurar requisição para a Hubla:', error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Erro interno ao cancelar assinatura',
        details: error.message
      });
    }
  }
}

// Função para processar webhook
async function handleWebhook(req, res, apiKey) {
  // Para verificação do webhook pela Hubla (se necessário)
  if (req.method === 'GET') {
    return res.status(200).json({ message: 'Endpoint de webhook da Hubla configurado com sucesso' });
  }

  // Verificar se o método da requisição é POST para processar eventos
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter dados do corpo da requisição
    const eventData = req.body;
    console.log('Evento webhook recebido da Hubla:', JSON.stringify(eventData).substring(0, 200) + '...');

    // Verificar se é um evento válido
    if (!eventData || !eventData.event) {
      console.error('Formato inválido do webhook da Hubla');
      return res.status(400).json({ error: 'Formato inválido do webhook' });
    }

    // Verificar o token de segurança do webhook (se a Hubla fornecer)
    const hublaWebhookToken = process.env.HUBLA_WEBHOOK_TOKEN;
    if (hublaWebhookToken) {
      const receivedToken = req.headers['x-webhook-token'] || '';
      if (receivedToken !== hublaWebhookToken) {
        console.error('Token de segurança inválido do webhook da Hubla');
        return res.status(403).json({ error: 'Token de segurança inválido' });
      }
    }

    // Processar diferentes tipos de eventos
    const eventType = eventData.event;
    const resourceData = eventData.data || {};
    const resourceId = resourceData.id;

    console.log(`Processando evento ${eventType} para recurso ${resourceId}`);

    // Implementar lógica com base no tipo de evento
    switch (eventType) {
      case 'PAYMENT.CONFIRMED':
      case 'PAYMENT.RECEIVED':
      case 'PAYMENT.APPROVED':
        // Atualizar status de pagamento no banco de dados
        await handlePaymentConfirmed(resourceData);
        break;
        
      case 'PAYMENT.OVERDUE':
      case 'PAYMENT.DECLINED':
      case 'PAYMENT.FAILED':
        // Atualizar status para pagamento com falha
        await handlePaymentFailed(resourceData);
        break;
        
      case 'SUBSCRIPTION.CANCELLED':
        // Atualizar status de assinatura no banco de dados
        await handleSubscriptionCancelled(resourceData);
        break;
        
      case 'SUBSCRIPTION.RENEWED':
        // Processar renovação de assinatura
        await handleSubscriptionRenewed(resourceData);
        break;
        
      default:
        console.log(`Evento não processado: ${eventType}`);
    }

    // Responder ao webhook
    return res.status(200).json({ message: 'Evento processado com sucesso' });
    
  } catch (error) {
    console.error('Erro ao processar webhook da Hubla:', error.message);
    return res.status(500).json({ error: 'Erro interno ao processar webhook' });
  }
}

// Funções auxiliares para processar eventos de webhook
async function handlePaymentConfirmed(paymentData) {
  // Atualizar o status do pagamento no banco de dados
  console.log('Pagamento confirmado:', paymentData.id);
  
  // Aqui você deve implementar a lógica para atualizar seu banco de dados
  // Por exemplo, usando uma API interna ou um cliente de banco de dados
  
  try {
    // Exemplo: Notificar um serviço interno
    await axios.post(
      process.env.INTERNAL_API_URL + '/update-payment-status',
      {
        externalId: paymentData.id,
        status: 'PAID',
        paidDate: paymentData.confirmedDate || new Date().toISOString(),
        value: paymentData.value,
        externalReference: paymentData.externalReference
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    ).catch(err => {
      console.error('Erro ao notificar serviço interno (ignorando):', err.message);
    });
  } catch (err) {
    console.error('Erro ao atualizar status do pagamento:', err.message);
    // Continuar mesmo com erro para não falhar o webhook
  }
}

async function handlePaymentFailed(paymentData) {
  console.log('Pagamento com falha:', paymentData.id);
  
  try {
    // Exemplo: Notificar um serviço interno
    await axios.post(
      process.env.INTERNAL_API_URL + '/update-payment-status',
      {
        externalId: paymentData.id,
        status: 'FAILED',
        failReason: paymentData.failReason || 'Pagamento falhou na Hubla',
        externalReference: paymentData.externalReference
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    ).catch(err => {
      console.error('Erro ao notificar serviço interno (ignorando):', err.message);
    });
  } catch (err) {
    console.error('Erro ao atualizar status do pagamento falho:', err.message);
  }
}

async function handleSubscriptionCancelled(subscriptionData) {
  console.log('Assinatura cancelada:', subscriptionData.id);
  
  try {
    // Exemplo: Notificar um serviço interno
    await axios.post(
      process.env.INTERNAL_API_URL + '/update-subscription-status',
      {
        externalId: subscriptionData.id,
        status: 'CANCELLED',
        cancelledDate: subscriptionData.cancelledDate || new Date().toISOString(),
        externalReference: subscriptionData.externalReference
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    ).catch(err => {
      console.error('Erro ao notificar serviço interno (ignorando):', err.message);
    });
  } catch (err) {
    console.error('Erro ao atualizar status da assinatura cancelada:', err.message);
  }
}

async function handleSubscriptionRenewed(subscriptionData) {
  console.log('Assinatura renovada:', subscriptionData.id);
  
  try {
    // Exemplo: Notificar um serviço interno
    await axios.post(
      process.env.INTERNAL_API_URL + '/update-subscription-status',
      {
        externalId: subscriptionData.id,
        status: 'ACTIVE',
        nextDueDate: subscriptionData.nextDueDate,
        externalReference: subscriptionData.externalReference
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    ).catch(err => {
      console.error('Erro ao notificar serviço interno (ignorando):', err.message);
    });
  } catch (err) {
    console.error('Erro ao atualizar status da assinatura renovada:', err.message);
  }
} 