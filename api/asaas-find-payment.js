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
    // Obter o ID do pagamento da query
    const { paymentId } = req.query;

    console.log('=== REQUISIÇÃO PARA VERIFICAR PAGAMENTO ===');
    console.log('Método:', req.method);
    console.log('URL:', req.url);
    console.log('Query:', req.query);
    console.log('PaymentId:', paymentId);

    if (!paymentId) {
      return res.status(400).json({ 
        error: 'Parâmetro ausente', 
        details: 'ID do pagamento é obrigatório' 
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

    console.log('Fazendo requisição para o Asaas:', {
      url: `${asaasBaseUrl}/payments/${paymentId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RunCash/1.0',
        'access_token': `${asaasApiKey.substring(0, 10)}...`
      }
    });

    // Buscar detalhes do pagamento
    const response = await axios.get(
      `${asaasBaseUrl}/payments/${paymentId}`,
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

    console.log('Resposta do Asaas:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: typeof response.data === 'object' ? response.data : 'Resposta não é JSON'
    });

    // Verificar se a resposta foi bem sucedida
    if (response.status !== 200) {
      console.error('Erro na resposta do Asaas:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
      return res.status(response.status).json({ 
        error: 'Erro ao buscar pagamento na API do Asaas',
        details: response.data
      });
    }

    // Verificar se a resposta contém os dados do pagamento
    if (!response.data || !response.data.id) {
      return res.status(404).json({ 
        error: 'Pagamento não encontrado',
        details: 'Não foi possível encontrar este pagamento'
      });
    }

    // Retornar os dados do pagamento
    return res.status(200).json({
      success: true,
      payment: {
        id: response.data.id,
        customer: response.data.customer,
        value: response.data.value,
        netValue: response.data.netValue,
        billingType: response.data.billingType,
        status: response.data.status,
        dueDate: response.data.dueDate,
        paymentDate: response.data.paymentDate,
        invoiceUrl: response.data.invoiceUrl,
        bankSlipUrl: response.data.bankSlipUrl,
        transactionReceiptUrl: response.data.transactionReceiptUrl,
        nossoNumero: response.data.nossoNumero,
        description: response.data.description,
        subscription: response.data.subscription,
        installment: response.data.installment,
        creditCard: response.data.creditCard ? {
          creditCardBrand: response.data.creditCard.creditCardBrand,
          creditCardNumber: response.data.creditCard.creditCardNumber,
        } : null,
        fine: response.data.fine,
        interest: response.data.interest,
        split: response.data.split
      }
    });
  } catch (error) {
    console.error('Erro ao buscar pagamento:', error);
    
    // Tratar erros específicos da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({ 
      error: 'Erro ao buscar pagamento',
      message: error.message 
    });
  }
}; 