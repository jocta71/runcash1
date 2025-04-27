// Importação do módulo de proxy
import { createProxyMiddleware } from 'http-proxy-middleware';

export default async function handler(req, res) {
  // Preservar os parâmetros de consulta originais
  const queryParams = new URLSearchParams(req.url.split('?')[1] || '').toString();
  const targetPath = `/api/ROULETTES${queryParams ? `?${queryParams}` : ''}`;
  
  // URL completa para o backend no Railway
  const targetUrl = `https://backend-production-2f96.up.railway.app${targetPath}`;
  
  console.log(`Redirecionando para: ${targetUrl}`);

  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Responder diretamente para solicitações preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Fazer a solicitação para o backend
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        // Incluir cabeçalhos de autorização se necessário
        ...(req.headers.authorization ? { 'Authorization': req.headers.authorization } : {})
      },
      // Incluir corpo da requisição para métodos que não sejam GET
      ...(req.method !== 'GET' && req.body ? { body: JSON.stringify(req.body) } : {})
    });

    // Obter dados da resposta
    const data = await response.json();

    // Retornar resposta com status code apropriado
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Erro na solicitação proxy para roletas:', error);
    return res.status(500).json({ error: 'Erro ao acessar a API de roletas' });
  }
} 