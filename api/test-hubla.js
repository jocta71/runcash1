const axios = require('axios');

// Handler para testar integração com Hubla
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Lidar com solicitações OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar configuração de variáveis de ambiente
    const hublaApiKey = process.env.HUBLA_API_KEY;
    const hublaWebhookSecret = process.env.HUBLA_WEBHOOK_SECRET;
    
    // Resultados do teste
    const results = {
      environment: process.env.NODE_ENV || 'development',
      hubla: {
        apiKeyConfigured: !!hublaApiKey,
        apiKeyPreview: hublaApiKey ? `${hublaApiKey.substring(0, 5)}...` : null,
        webhookSecretConfigured: !!hublaWebhookSecret
      },
      serverInfo: {
        date: new Date().toISOString(),
        nodejs: process.version
      }
    };
    
    // Testar conexão com a API do Hubla (se configurada)
    if (hublaApiKey) {
      try {
        // Fazer uma solicitação simples para verificar acesso
        const response = await axios.get(
          'https://api.hub.la/api/account',
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${hublaApiKey}`
            }
          }
        );
        
        // Adicionar resultado do teste de conexão
        results.hubla.connectionTest = {
          success: true,
          accountStatus: response.data.status || 'unknown',
          message: 'Conexão com API do Hubla estabelecida com sucesso'
        };
      } catch (apiError) {
        // Adicionar informações do erro
        results.hubla.connectionTest = {
          success: false,
          status: apiError.response?.status,
          message: apiError.message,
          details: apiError.response?.data
        };
      }
    }
    
    // Retornar resultados
    return res.status(200).json(results);
    
  } catch (error) {
    console.error('Erro ao testar integração com Hubla:', error);
    return res.status(500).json({
      error: 'Erro ao testar integração',
      message: error.message
    });
  }
}; 