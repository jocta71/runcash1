const axios = require('axios');

/**
 * Endpoint para testar a configuração da integração com a Hubla
 * Verifica se as variáveis de ambiente necessárias estão configuradas
 */

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
    // Verificar API key da Hubla
    const apiKey = process.env.HUBLA_API_KEY;
    const webhookSecret = process.env.HUBLA_WEBHOOK_SECRET;
    
    // Criar uma versão segura para exibição da API key (se existir)
    let apiKeyPreview = null;
    if (apiKey) {
      // Mostrar apenas os primeiros 4 e últimos 4 caracteres
      apiKeyPreview = apiKey.length > 8 
        ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
        : "****";
    }
    
    // Resultados do teste
    const results = {
      environment: process.env.NODE_ENV || 'development',
      apiKeyConfigured: !!apiKey,
      apiKeyPreview,
      webhookSecretConfigured: !!webhookSecret,
      serverInfo: {
        nodejs: process.version,
        timestamp: new Date().toISOString()
      },
      checkoutUrls: {
        basic: process.env.HUBLA_CHECKOUT_URL_BASIC || 'Não configurado',
        pro: process.env.HUBLA_CHECKOUT_URL_PRO || 'Não configurado'
      }
    };
    
    // Adicionar informações de sandbox se disponíveis
    if (process.env.HUBLA_SANDBOX_MODE === 'true') {
      results.sandbox = {
        enabled: true,
        basicUrl: process.env.HUBLA_SANDBOX_URL_BASIC || 'Não configurado',
        proUrl: process.env.HUBLA_SANDBOX_URL_PRO || 'Não configurado'
      };
    }
    
    return res.status(200).json(results);
  } catch (error) {
    console.error('Erro ao testar configuração da Hubla:', error);
    return res.status(500).json({ 
      error: 'Erro ao testar configuração da Hubla',
      message: error.message
    });
  }
}; 