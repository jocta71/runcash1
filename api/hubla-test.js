// Endpoint de teste para verificar a conexão com a API da Hubla
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

  // Verificar se a chave da API da Hubla está configurada
  const hublaApiKey = process.env.HUBLA_API_KEY;
  const hublaApiStatus = hublaApiKey 
    ? `Configurada (primeiros 5 caracteres: ${hublaApiKey.substring(0, 5)}...)` 
    : 'Não configurada';

  // Verificar se a chave da API da Asaas está configurada (para comparação)
  const asaasApiKey = process.env.ASAAS_API_KEY;
  const asaasApiStatus = asaasApiKey 
    ? `Configurada (primeiros 5 caracteres: ${asaasApiKey.substring(0, 5)}...)` 
    : 'Não configurada';

  // Informações sobre o ambiente
  const environment = {
    NODE_ENV: process.env.NODE_ENV || 'não definido',
    VERCEL_ENV: process.env.VERCEL_ENV || 'não definido',
    VERCEL_URL: process.env.VERCEL_URL || 'não definido',
    VERCEL_REGION: process.env.VERCEL_REGION || 'não definido'
  };

  // Retornar informações sobre a configuração
  return res.status(200).json({
    message: 'Teste de integração com a Hubla',
    timestamp: new Date().toISOString(),
    hubla: {
      apiKey: hublaApiStatus
    },
    asaas: {
      apiKey: asaasApiStatus
    },
    environment
  });
}; 