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

    // Obter ID da assinatura da query
    const { id } = req.query;

    // Validar parâmetro obrigatório
    if (!id) {
      console.error('ID da assinatura não fornecido');
      return res.status(400).json({ error: 'ID da assinatura é obrigatório' });
    }

    console.log(`Buscando detalhes da assinatura: ${id}`);

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
}; 