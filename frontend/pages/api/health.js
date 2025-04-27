// Endpoint de verificação de saúde para o frontend
export default async function handler(req, res) {
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
  const backendApiUrl = process.env.BACKEND_API_URL || 'https://backendapi-production-36b5.up.railway.app';
  
  // Tentar verificar a saúde do backend
  let backendStatus = 'unknown';
  let backendApiStatus = 'unknown';
  let backendError = null;
  let backendApiError = null;
  
  try {
    // Verifica o status do backend principal (Railway)
    const backendCheck = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000)
    }).catch(error => {
      backendError = error.message;
      return { ok: false };
    });
    
    backendStatus = backendCheck.ok ? 'online' : 'offline';
  } catch (error) {
    backendStatus = 'error';
    backendError = error.message;
  }
  
  try {
    // Verifica o status da API de autenticação
    const apiCheck = await fetch(`${backendApiUrl}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000)
    }).catch(error => {
      backendApiError = error.message;
      return { ok: false };
    });
    
    backendApiStatus = apiCheck.ok ? 'online' : 'offline';
  } catch (error) {
    backendApiStatus = 'error';
    backendApiError = error.message;
  }
  
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
    endpoints: {
      backend: {
        url: backendUrl,
        status: backendStatus,
        error: backendError
      },
      api: {
        url: backendApiUrl,
        status: backendApiStatus,
        error: backendApiError
      }
    },
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