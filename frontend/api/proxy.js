// Proxy para contornar problemas de CORS no Railway
const https = require('https');
const http = require('http');
const url = require('url');
const cookie = require('cookie');

// URL do backend no Railway
const BACKEND_URL = 'https://backend-production-2f96.up.railway.app';

// Função para encaminhar a requisição
const proxyRequest = (req, res, path) => {
  const parsedUrl = url.parse(BACKEND_URL);
  const isHttps = parsedUrl.protocol === 'https:';

  // Extrair tokens de autenticação dos cookies
  const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
  const authToken = cookies['auth-token'] || '';
  const refreshToken = cookies['refresh-token'] || '';

  // Log do caminho e origem
  console.log(`[PROXY] Origem: ${req.headers.origin || 'desconhecida'}`);
  console.log(`[PROXY] Path: ${path}`);
  console.log(`[PROXY] Auth token presente: ${authToken ? 'Sim' : 'Não'}`);

  // Configurar opções do request
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: `${parsedUrl.path !== '/' ? parsedUrl.path : ''}${path}`,
    method: req.method,
    headers: {
      ...req.headers,
      host: parsedUrl.hostname,
      'Authorization': authToken ? `Bearer ${authToken}` : '',
      'X-Refresh-Token': refreshToken || '',
      'Connection': 'keep-alive',
    }
  };

  // Remover headers problemáticos
  delete options.headers['host'];
  
  // Para requisições com corpo (POST, PUT, PATCH)
  let body = [];
  req.on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();
    
    // Debugar requisição
    console.log(`[PROXY] Reenviando requisição para: ${BACKEND_URL}${options.path}`);
    
    // Escolher o protocolo correto (http ou https)
    const protocol = isHttps ? https : http;
    
    // Criar a requisição para o backend
    const proxyReq = protocol.request(options, (proxyRes) => {
      // Log da resposta
      console.log(`[PROXY] Resposta do backend: ${proxyRes.statusCode}`);
      
      // Configurar os headers da resposta
      Object.keys(proxyRes.headers).forEach(key => {
        // Não passar headers de CORS do backend, vamos definir nossos próprios
        if (!key.toLowerCase().startsWith('access-control-')) {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      
      // Definir headers CORS para permitir todas as origens
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      // Definir o status code
      res.statusCode = proxyRes.statusCode;
      
      // Encaminhar os dados da resposta
      proxyRes.pipe(res, { end: true });
    });
    
    // Lidar com erros na requisição
    proxyReq.on('error', (error) => {
      console.error('[PROXY] Erro:', error);
      res.statusCode = 500;
      res.end(`Erro na comunicação com o backend: ${error.message}`);
    });
    
    // Enviar o corpo da requisição se for um método que aceita corpo
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && body) {
      proxyReq.write(body);
    }
    
    // Finalizar a requisição
    proxyReq.end();
  });
}

// Handler para requisições API
module.exports = (req, res) => {
  // Definir headers CORS para permitir todas as origens
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Tratar preflight requests (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }
  
  // Obter o path específico, se fornecido como query parameter
  const queryParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const path = queryParams.get('path') || req.url;
  
  console.log(`[PROXY] Iniciando proxy. Método: ${req.method}, Path: ${path}`);
  
  // Encaminhar a requisição para o backend
  proxyRequest(req, res, path);
}; 