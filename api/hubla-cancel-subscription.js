const axios = require('axios');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Lidar com requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar se o método é POST
  if (req.method !== 'POST') {
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

    // Obter ID da assinatura do corpo da requisição
    const { subscriptionId } = req.body;

    // Validar parâmetro obrigatório
    if (!subscriptionId) {
      console.error('ID da assinatura não fornecido');
      return res.status(400).json({ error: 'ID da assinatura é obrigatório' });
    }

    console.log(`Cancelando assinatura: ${subscriptionId}`);

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
}; 