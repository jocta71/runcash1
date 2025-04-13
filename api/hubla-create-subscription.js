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

  // Apenas aceitar POST
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
      description = '',
      externalReference = '',
      callbackUrl
    } = req.body;

    // Validar dados obrigatórios
    if (!customerId || !planId || !value || !cycle || !nextDueDate) {
      return res.status(400).json({ 
        error: 'Dados incompletos. ID do cliente, ID do plano, valor, ciclo e próxima data de vencimento são obrigatórios.' 
      });
    }

    // Configurar requisição para a API do Hubla
    const hublaApiKey = process.env.HUBLA_API_KEY;
    console.log("Chave API em uso (primeiros 10 caracteres):", hublaApiKey?.substring(0, 10) + "...");
    
    if (!hublaApiKey) {
      console.error('HUBLA_API_KEY não configurada no ambiente');
      return res.status(500).json({ error: 'Erro de configuração do servidor' });
    }

    // Configuração do Axios para o Hubla
    const hublaConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hublaApiKey}`
      }
    };

    console.log("Tentando criar assinatura no Hubla:", JSON.stringify({
      customerId,
      planId,
      value,
      cycle,
      nextDueDate
    }));

    // Criar payload da assinatura
    const subscriptionData = {
      customer: customerId,
      plan: planId,
      value,
      cycle, // Exemplo: 'MONTHLY', 'WEEKLY', 'YEARLY'
      description,
      nextDueDate,
      externalReference,
      autoRenewal: true,
      updatePendingPayments: true
    };

    // Adicionar URL de callback se fornecida
    if (callbackUrl) {
      subscriptionData.notificationUrl = callbackUrl;
    }

    // Criar a assinatura no Hubla
    const createResponse = await axios.post(
      'https://api.hubla.com.br/v1/subscriptions',
      subscriptionData,
      hublaConfig
    );

    // Verificar resposta da API
    if (createResponse.status === 200 || createResponse.status === 201) {
      const subscriptionId = createResponse.data.id;
      console.log(`Assinatura criada com sucesso: ${subscriptionId}`);

      // Buscar link de pagamento para a assinatura criada
      let paymentUrl = null;
      try {
        // Buscar pagamentos pendentes da assinatura
        const paymentsResponse = await axios.get(
          `https://api.hubla.com.br/v1/subscriptions/${subscriptionId}/payments?status=PENDING`,
          hublaConfig
        );

        // Se houver pagamentos pendentes, pegar o primeiro
        if (paymentsResponse.data && paymentsResponse.data.length > 0) {
          const payment = paymentsResponse.data[0];
          
          // Buscar link de pagamento
          const linkResponse = await axios.get(
            `https://api.hubla.com.br/v1/payments/${payment.id}/paymentlink`,
            hublaConfig
          );

          if (linkResponse.data && linkResponse.data.url) {
            paymentUrl = linkResponse.data.url;
          }
        }
      } catch (linkError) {
        console.error("Erro ao obter link de pagamento:", linkError.message);
        // Não rejeitar a resposta principal se não conseguir o link de pagamento
      }

      // Retornar informações da assinatura e link de pagamento, se disponível
      return res.status(201).json({ 
        subscriptionId,
        paymentUrl,
        message: 'Assinatura criada com sucesso'
      });
    } else {
      throw new Error(`Resposta inesperada da API do Hubla: ${createResponse.status}`);
    }
  } catch (error) {
    console.error('Erro ao criar assinatura no Hubla:', error.message);
    
    // Loggar detalhes do erro se disponíveis
    if (error.response) {
      console.error('Status do erro:', error.response.status);
      console.error('Detalhes do erro:', error.response.data);
    }
    
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || 'Erro ao criar assinatura no Hubla',
      details: error.response?.data || error.message
    });
  }
}; 