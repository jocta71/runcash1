// Proxy para contornar problemas de CORS no Railway
const https = require('https');
const http = require('http');
const url = require('url');

// URL do backend no Railway - usar a variável de ambiente ou o valor padrão
const BACKEND_URL = process.env.BACKEND_URL || 'https://runcash1-production.up.railway.app';
const SECONDARY_BACKEND_URL = 'https://backendapi-production-36b5.up.railway.app';

console.log(`[API Proxy] Usando endpoint principal: ${BACKEND_URL}`);
console.log(`[API Proxy] Usando endpoint secundário: ${SECONDARY_BACKEND_URL}`);

// Função para encaminhar a requisição
function proxyRequest(req, res, path, targetUrl) {
  // Analisar a URL do backend
  const parsedUrl = url.parse(targetUrl);
  
  // Obter os dados do corpo da requisição (se houver)
  let body = [];
  req.on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();
    
    // Configurar as opções da requisição para o backend
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: path || req.url.replace('/api', '/api'),
      method: req.method,
      headers: {
        ...req.headers,
        host: parsedUrl.hostname,
      }
    };
    
    // Remover headers problemáticos
    delete options.headers['content-length'];
    
    // Debugar requisição
    console.log(`[API Proxy] Reenviando requisição para: ${targetUrl}${options.path}`);
    
    // Escolher o protocolo correto (http ou https)
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    // Criar a requisição para o backend
    const proxyReq = protocol.request(options, (proxyRes) => {
      // Configurar os headers da resposta
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      
      // Encaminhar os dados da resposta
      proxyRes.pipe(res, { end: true });
    });
    
    // Lidar com erros na requisição
    proxyReq.on('error', (error) => {
      console.error('[API Proxy] Erro:', error);
      
      // Se a requisição falhar para o backend principal, tentar o secundário
      if (targetUrl === BACKEND_URL && SECONDARY_BACKEND_URL) {
        console.log(`[API Proxy] Tentando backend secundário: ${SECONDARY_BACKEND_URL}`);
        return proxyRequest(req, res, path, SECONDARY_BACKEND_URL);
      }
      
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

// Determinar o backend a ser usado com base no path
function getBackendForPath(path) {
  // Rotas específicas para o backend secundário
  const secondaryPaths = [
    '/api/payment/',
    '/api/asaas-',
    '/api/assinatura'
  ];
  
  // Verificar se o path corresponde a alguma rota secundária
  for (const prefix of secondaryPaths) {
    if (path.startsWith(prefix)) {
      return SECONDARY_BACKEND_URL;
    }
  }
  
  // Verificar se são os novos endpoints de roleta otimizada
  const optimizedPaths = [
    '/api/roulettes-batch',
    '/api/roulettes-list',
    '/api/ROULETTES-optimized',
    '/api/diagnostico'
  ];
  
  for (const prefix of optimizedPaths) {
    if (path.includes(prefix)) {
      console.log(`[API Proxy] Detectado endpoint otimizado: ${path}`);
      return BACKEND_URL;
    }
  }
  
  // Usar o backend padrão para as demais rotas
  return BACKEND_URL;
}

// Handler para requisições API
module.exports = (req, res) => {
  // Definir headers CORS para permitir todas as origens
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  // Tratar preflight requests (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }
  
  // Obter o path específico, se fornecido como query parameter
  const urlParts = url.parse(req.url, true);
  const { path } = urlParts.query;
  const targetPath = path || req.url;
  
  // Determinar o backend com base no path
  const targetBackend = getBackendForPath(targetPath);
  console.log(`[API Proxy] Path: ${targetPath} => Backend: ${targetBackend}`);
  
  // Encaminhar a requisição para o backend apropriado
  proxyRequest(req, res, targetPath, targetBackend);
}; 