// Endpoint de teste para verificar a configuração do Vercel
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Obter valor da variável de ambiente
  const asaasApiKey = process.env.ASAAS_API_KEY;
  const apiKeyStatus = asaasApiKey 
    ? `Configurada (primeiros 10 caracteres: ${asaasApiKey.substring(0, 10)}...)` 
    : 'Não configurada';
  
  return res.status(200).json({
    status: 'success',
    message: 'API funcionando corretamente',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    asaasApiKey: apiKeyStatus,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      ASAAS_API_KEY_CONFIGURED: !!process.env.ASAAS_API_KEY
    }
  });
}; 