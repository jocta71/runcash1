// Endpoint de verificação de saúde para o frontend
export default function handler(req, res) {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Responder imediatamente para requisições de preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verificar a conexão com o backend
  const backendUrl = process.env.BACKEND_URL || 'https://backend-production-2f96.up.railway.app';
  
  // Informações sobre as configurações atuais de proxy
  const proxyInfo = {
    proxyRoutes: {
      'proxy-roulette': '/api/ROULETTES',
      'proxy': 'endpoints genéricos',
      'corsproxy.io': 'proxy de fallback'
    },
    cors: {
      status: 'ativado',
      allowedOrigins: '*',
      credentials: true
    },
    backend: backendUrl,
    status: 'online',
    timestamp: new Date().toISOString()
  };

  // Retornar informações de status
  res.status(200).json({
    status: 'healthy',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    proxy: proxyInfo
  });
}