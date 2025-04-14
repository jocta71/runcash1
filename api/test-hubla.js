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
        webhookSecretConfigured: !!hublaWebhookSecret,
        webhookConfigured: true, // Já confirmado pela interface do Hubla
        webhookEvents: [
          "Assinatura criada (v2)",
          "Assinatura ativa (v2)",
          "Assinatura desativada (v2)",
          "Assinatura expirada (v2)",
          "Assinatura: Renovação desativada (v2)",
          "Assinatura: Renovação ativada (v2)",
          "Novo usuário"
        ]
      },
      serverInfo: {
        date: new Date().toISOString(),
        nodejs: process.version
      }
    };
    
    // Não testar conexão com API - aguardar documentação oficial
    
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