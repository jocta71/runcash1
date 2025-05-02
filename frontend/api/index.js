// API handler para endpoint raiz
export default function handler(req, res) {
  // Verificar o método da requisição
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido',
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  // Responder com informações básicas da API
  res.status(200).json({
    success: true,
    name: 'RunCash API',
    version: '1.0.0',
    endpoints: {
      '/api/health': 'Verificação básica de saúde',
      '/api/status': 'Status detalhado do sistema',
      '/api/assinatura/planos': 'Lista de planos disponíveis',
      '/api/assinatura/status': 'Status da assinatura do usuário',
      '/api/assinatura/checkout': 'Criar checkout para assinatura'
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
} 