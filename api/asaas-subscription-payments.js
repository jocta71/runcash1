const axios = require('axios');
const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar método da requisição
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter o ID da assinatura da query
    const { subscriptionId } = req.query;

    console.log('=== REQUISIÇÃO PARA LISTAR PAGAMENTOS DA ASSINATURA ===');
    console.log('Método:', req.method);
    console.log('URL:', req.url);
    console.log('Query:', req.query);
    console.log('SubscriptionId:', subscriptionId);

    if (!subscriptionId) {
      return res.status(400).json({ 
        error: 'Parâmetro ausente', 
        details: 'ID da assinatura é obrigatório' 
      });
    }

    // Forçar uso do sandbox enquanto estamos em teste
    const ASAAS_ENVIRONMENT = 'sandbox';
    console.log(`Usando ambiente Asaas: ${ASAAS_ENVIRONMENT}`);
    
    // Configurar chamada para API do Asaas
    const asaasBaseUrl = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
    const asaasApiKey = process.env.ASAAS_API_KEY;

    console.log('Configuração do Asaas:', {
      baseUrl: asaasBaseUrl,
      apiKey: asaasApiKey ? `${asaasApiKey.substring(0, 10)}...` : 'não definido'
    });

    if (!asaasApiKey) {
      throw new Error('Chave da API do Asaas não configurada');
    }

    // Construir a URL para listar os pagamentos da assinatura
    // O filtro subscription é o ID da assinatura
    const requestUrl = `${asaasBaseUrl}/payments?subscription=${subscriptionId}`;
    
    console.log('Fazendo requisição para o Asaas:', {
      url: requestUrl,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RunCash/1.0',
        'access_token': `${asaasApiKey.substring(0, 10)}...`
      }
    });

    // Buscar pagamentos da assinatura
    const response = await axios.get(
      requestUrl,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': asaasApiKey
        },
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      }
    );

    console.log('Resposta do Asaas (Pagamentos):', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: typeof response.data === 'object' ? 'Objeto JSON recebido' : 'Resposta não é JSON'
    });

    // Verificar se a resposta foi bem sucedida
    if (response.status !== 200) {
      console.error('Erro na resposta do Asaas:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
      return res.status(response.status).json({ 
        error: 'Erro ao listar pagamentos da assinatura',
        details: response.data
      });
    }

    // Registrar no MongoDB
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db();

    if (response.data && response.data.data && response.data.data.length > 0) {
      // Salvar os IDs dos pagamentos no MongoDB
      const paymentsData = response.data.data.map(payment => ({
        payment_id: payment.id,
        subscription_id: subscriptionId,
        value: payment.value,
        status: payment.status,
        due_date: payment.dueDate,
        billing_type: payment.billingType,
        indexed_at: new Date()
      }));

      await db.collection('subscription_payments').insertMany(paymentsData);
      console.log(`Cadastrados ${paymentsData.length} pagamentos no MongoDB`);
    } else {
      console.log('Nenhum pagamento encontrado para esta assinatura');
    }
    
    await client.close();

    // Retornar os dados dos pagamentos
    return res.status(200).json({
      success: true,
      subscriptionId: subscriptionId,
      payments: response.data.data,
      count: response.data.data ? response.data.data.length : 0
    });
  } catch (error) {
    console.error('Erro ao listar pagamentos da assinatura:', error);
    
    // Tratar erros específicos da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({ 
      error: 'Erro ao listar pagamentos da assinatura',
      message: error.message 
    });
  }
}; 