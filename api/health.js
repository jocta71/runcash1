module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS para permitir acesso de qualquer origem
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Se for uma requisição OPTIONS, retornar 200 imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Responder com status 200 e um objeto JSON simples
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'API está funcionando corretamente',
      service: 'runcash-api'
    });
  } catch (error) {
    // Em caso de erro, responder com status 500
    return res.status(500).json({
      status: 'error',
      message: 'Erro ao verificar saúde da API',
      error: error.message
    });
  }
}; 