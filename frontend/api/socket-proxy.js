// Proxy para conexões Socket.IO
const https = require('https');
const http = require('http');
const url = require('url');

// URL do backend no Railway
const BACKEND_URL = 'https://runcash1-production.up.railway.app';

// Handler para requisições de proxy do Socket.IO
module.exports = (req, res) => {
  // Definir headers CORS para permitir todas as origens
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  // Tratar preflight requests (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }
  
  // Analisar a URL do backend
  const parsedUrl = url.parse(BACKEND_URL);
  
  // Obter os dados do corpo da requisição (se houver)
  let body = [];
  req.on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();
    
    // Extrair o path da requisição original
    const originalPath = req.url.replace('/api/socket-proxy', '');
    
    // Configurar as opções da requisição para o backend
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: originalPath,
      method: req.method,
      headers: {
        ...req.headers,
        host: parsedUrl.hostname,
      }
    };
    
    // Remover headers problemáticos
    delete options.headers['content-length'];
    
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
      console.error('Erro no proxy Socket.IO:', error);
      res.statusCode = 500;
      res.end(`Erro na comunicação com o backend Socket.IO: ${error.message}`);
    });
    
    // Enviar o corpo da requisição se for um método que aceita corpo
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && body) {
      proxyReq.write(body);
    }
    
    // Finalizar a requisição
    proxyReq.end();
  });
}; 