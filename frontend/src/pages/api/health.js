// API handler para verificação de saúde do sistema
export default function handler(req, res) {
  // Verificar o método da requisição
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido',
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  // Responder com status de saúde
  res.status(200).json({
    success: true,
    status: 'online',
    service: 'RunCash Frontend API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
} 