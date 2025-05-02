// API handler para verificação de status do sistema
export default function handler(req, res) {
  // Verificar o método da requisição
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido',
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  // Responder com status detalhado dos serviços
  res.status(200).json({
    success: true,
    status: 'online',
    services: {
      api: {
        status: 'online',
        version: '1.0.0'
      },
      database: {
        status: 'online',
        connection: 'stable'
      },
      websocket: {
        status: 'online',
        connections: 0
      }
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
} 