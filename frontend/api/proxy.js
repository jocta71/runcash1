// Proxy para contornar problemas de CORS no Railway
const https = require('https');
const http = require('http');
const url = require('url');

// URL do backend no Railway
const BACKEND_URL = 'https://backendapi-production-36b5.up.railway.app';

// Função para encaminhar a requisição
function proxyRequest(req, res, path) {
  // Analisar a URL do backend
  const parsedUrl = url.parse(BACKEND_URL);
  
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
    console.log(`Proxy reenviando requisição para: ${BACKEND_URL}${options.path}`);
    
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
      console.error('Erro no proxy:', error);
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  // Tratar preflight requests (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }
  
  // Obter o path específico, se fornecido como query parameter
  const { path } = url.parse(req.url, true).query;
  const targetPath = path || req.url;
  
  // Encaminhar a requisição para o backend
  proxyRequest(req, res, targetPath);
}; 