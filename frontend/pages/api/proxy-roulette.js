// Proxy específico para requisições de roletas
import https from 'https';
import http from 'http';
import url from 'url';
import cookie from 'cookie';

// URL do backend no Railway
const BACKEND_URL = 'https://backend-production-2f96.up.railway.app';
const API_PATH = '/api/ROULETTES';

export default function handler(req, res) {
  // Configurar CORS para permitir requisições cross-origin
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, bypass-tunnel-reminder');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Responder imediatamente para requisições de preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Extrair tokens de autenticação dos cookies
  const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
  const authToken = cookies['auth-token'] || '';
  const refreshToken = cookies['refresh-token'] || '';

  // Construir URL completa incluindo query parameters do request original
  const originalUrl = new URL(req.url, `http://${req.headers.host}`);
  const queryParams = originalUrl.search || '';
  const targetPath = `${API_PATH}${queryParams}`;

  // Configurar opções para o request ao backend
  const parsedBackendUrl = url.parse(BACKEND_URL);
  const isHttps = parsedBackendUrl.protocol === 'https:';
  
  const options = {
    hostname: parsedBackendUrl.hostname,
    port: parsedBackendUrl.port || (isHttps ? 443 : 80),
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: parsedBackendUrl.hostname,
      'Authorization': authToken ? `Bearer ${authToken}` : '',
      'X-Refresh-Token': refreshToken || '',
      'Connection': 'keep-alive',
    }
  };

  // Remover headers problemáticos
  delete options.headers.host;
  delete options.headers.origin;
  
  console.log(`[PROXY-ROULETTE] Requisição para: ${BACKEND_URL}${targetPath}`);
  console.log(`[PROXY-ROULETTE] Query params: ${queryParams}`);
  
  // Preparar para receber o corpo da requisição
  let body = [];
  req.on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();
    
    // Escolher o protocolo correto (http ou https)
    const protocol = isHttps ? https : http;
    
    // Criar a requisição para o backend com timeout
    const proxyReq = protocol.request(options, (proxyRes) => {
      console.log(`[PROXY-ROULETTE] Resposta do backend: ${proxyRes.statusCode}`);
      
      // Configurar os headers da resposta
      Object.keys(proxyRes.headers).forEach(key => {
        // Não passar headers de CORS do backend, definimos nossos próprios
        if (!key.toLowerCase().startsWith('access-control-')) {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      
      // Definir o status code da resposta
      res.statusCode = proxyRes.statusCode;
      
      // Coletar os dados da resposta
      let responseData = [];
      proxyRes.on('data', (chunk) => {
        responseData.push(chunk);
      });
      
      // Quando todos os dados forem recebidos
      proxyRes.on('end', () => {
        const responseBody = Buffer.concat(responseData);
        res.end(responseBody);
      });
    });
    
    // Configurar timeout para a requisição
    proxyReq.setTimeout(30000, () => {
      proxyReq.destroy();
      console.error('[PROXY-ROULETTE] Timeout na requisição');
      res.status(504).json({
        error: true,
        message: 'Timeout na comunicação com o backend'
      });
    });
    
    // Lidar com erros na requisição
    proxyReq.on('error', (error) => {
      console.error('[PROXY-ROULETTE] Erro:', error);
      
      // Se a resposta ainda não foi enviada
      if (!res.headersSent) {
        res.status(500).json({
          error: true,
          message: `Erro na comunicação com o backend: ${error.message}`
        });
      }
    });
    
    // Enviar o corpo da requisição se aplicável
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && body) {
      proxyReq.write(body);
    }
    
    // Finalizar a requisição
    proxyReq.end();
  });
} 