const axios = require('axios');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Lidar com requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar se o método é GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter a chave da API da Hubla
    const apiKey = process.env.HUBLA_API_KEY;
    
    // Verificar se a chave da API está configurada
    if (!apiKey) {
      console.error('HUBLA_API_KEY não está configurada');
      return res.status(500).json({ error: 'Erro de configuração: HUBLA_API_KEY não encontrada' });
    }
    
    // Logar os primeiros caracteres da chave (para depuração)
    console.log(`Usando HUBLA_API_KEY: ${apiKey.substring(0, 5)}...`);

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
  } catch (error) {
    console.error('Erro ao executar testes da Hubla:', error.message);
    return res.status(500).json({ 
      error: 'Erro interno ao executar testes',
      details: error.message
    });
  }
}; 