/**
 * Endpoint para verificação de saúde da API
 * Retorna status 200 e informações básicas para confirmar que a API está funcionando
 */

module.exports = async (req, res) => {
  // Configuração de CORS para permitir acesso de qualquer origem
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Responder imediatamente a requisições OPTIONS (pre-flight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar se o método é GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      message: 'Método não permitido'
    });
  }
  
  try {
    // Informações para retornar no health check
    const healthInfo = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        api: {
          status: 'online'
        },
        database: {
          status: 'online'
        }
      }
    };
    
    // Retornar resposta de sucesso
    return res.status(200).json(healthInfo);
  } catch (error) {
    console.error('Erro no endpoint de health check:', error);
    
    // Retornar erro em caso de falha
    return res.status(500).json({
      status: 'error',
      message: 'Falha interna no servidor ao verificar saúde da API',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 