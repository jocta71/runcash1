const axios = require('axios');

// API handler para o Vercel Serverless
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Lidar com requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar se o método da requisição é POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar se a chave de API está configurada
    const apiKey = process.env.HUBLA_API_KEY;
    if (!apiKey) {
      console.error('HUBLA_API_KEY não está configurada nas variáveis de ambiente');
      return res.status(500).json({ error: 'Erro de configuração do servidor' });
    }

    console.log('Chave da API Hubla configurada:', apiKey.substring(0, 10) + '...');

    // Extrair dados do corpo da requisição
    const { 
      customerId, 
      planId, 
      value,
      cycle,
      description,
      nextDueDate,
      userId
    } = req.body;

    // Validar campos obrigatórios
    if (!customerId || !planId || !value || !cycle || !nextDueDate) {
      console.error('Dados de assinatura incompletos:', req.body);
      return res.status(400).json({ 
        error: 'Campos obrigatórios faltando', 
        requiredFields: ['customerId', 'planId', 'value', 'cycle', 'nextDueDate'] 
      });
    }

    console.log(`Criando assinatura na Hubla para cliente ${customerId}, plano ${planId}`);

    // Preparar dados para envio à API da Hubla
    const subscriptionData = {
      customer: customerId,
      plan: planId,
      value: parseFloat(value),
      cycle: cycle.toUpperCase(), // MONTHLY, YEARLY, etc.
      description: description || 'Assinatura RunCash',
      nextDueDate,
      externalReference: userId || undefined,
      autoRenewal: true,
      updatePendingPayments: true
    };

    // Fazer chamada à API da Hubla para criar assinatura
    const response = await axios.post(
      'https://api.hubla.com.br/v1/subscriptions',
      subscriptionData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Se a assinatura foi criada com sucesso, buscar o link de pagamento
    if (response.status === 200 || response.status === 201) {
      const subscriptionId = response.data.id;
      console.log('Assinatura criada com sucesso na Hubla:', subscriptionId);
      
      try {
        // Buscar o link de pagamento da primeira cobrança
        const paymentResponse = await axios.get(
          `https://api.hubla.com.br/v1/subscriptions/${subscriptionId}/payments?status=PENDING`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            }
          }
        );
        
        if (paymentResponse.data && paymentResponse.data.data && paymentResponse.data.data.length > 0) {
          const payment = paymentResponse.data.data[0];
          
          // Buscar o link de pagamento
          const invoiceResponse = await axios.get(
            `https://api.hubla.com.br/v1/payments/${payment.id}/paymentlink`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`
              }
            }
          );
          
          if (invoiceResponse.data && invoiceResponse.data.url) {
            return res.status(201).json({
              subscriptionId,
              paymentId: payment.id,
              redirectUrl: invoiceResponse.data.url,
              message: 'Assinatura criada com sucesso'
            });
          }
        }
        
        // Se não conseguir obter o link, retorna apenas o ID da assinatura
        return res.status(201).json({
          subscriptionId,
          message: 'Assinatura criada com sucesso, mas não foi possível obter o link de pagamento'
        });
      } catch (paymentError) {
        console.error('Erro ao buscar link de pagamento:', paymentError.message);
        return res.status(201).json({
          subscriptionId,
          message: 'Assinatura criada com sucesso, mas ocorreu um erro ao buscar o link de pagamento'
        });
      }
    } else {
      console.error('Resposta inesperada da API da Hubla:', response.status, response.data);
      return res.status(500).json({ 
        error: 'Erro ao criar assinatura na Hubla',
        hublaResponse: response.data
      });
    }
  } catch (error) {
    console.error('Erro ao criar assinatura na Hubla:', error.message);
    
    // Verificar se o erro é da API da Hubla
    if (error.response) {
      const { status, data } = error.response;
      
      // Retornar erro da API com detalhes
      return res.status(status).json({
        error: 'Erro retornado pela API da Hubla',
        details: data
      });
    }
    
    // Erro genérico
    return res.status(500).json({ 
      error: 'Erro interno ao processar a requisição',
      message: error.message
    });
  }
}; 