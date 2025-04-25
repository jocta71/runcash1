// Proxy para contornar problemas de CORS no Railway
const https = require('https');
const http = require('http');
const url = require('url');

// URL do backend no Railway
const BACKEND_URL = 'https://backendapi-production-36b5.up.railway.app';

// URLs alternativas para tentar em caso de falha
const BACKUP_URLS = [
  'https://runcash-websocket.up.railway.app',
  'https://api.runcash.app'
];

// Contador de falhas para cada URL
const failureCount = {
  [BACKEND_URL]: 0
};
BACKUP_URLS.forEach(url => failureCount[url] = 0);

// Função para encaminhar a requisição para uma URL específica
function proxyRequestToUrl(req, res, backendUrl, path, isRetry = false) {
  // Analisar a URL do backend
  const parsedUrl = url.parse(backendUrl);
  
  // Log detalhado
  console.log(`[PROXY] ${isRetry ? 'Tentando URL alternativa' : 'Enviando requisição para'}: ${backendUrl}${path}`);
  
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
      },
      timeout: 10000 // Timeout de 10 segundos
    };
    
    // Remover headers problemáticos
    delete options.headers['content-length'];
    
    // Escolher o protocolo correto (http ou https)
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    // Criar a requisição para o backend
    const proxyReq = protocol.request(options, (proxyRes) => {
      // Log de status
      console.log(`[PROXY] Resposta de ${backendUrl}: Status ${proxyRes.statusCode}`);
      
      // Se for um erro 5xx, tentar URL alternativa
      if (proxyRes.statusCode >= 500 && !isRetry) {
        failureCount[backendUrl]++;
        console.log(`[PROXY] Erro ${proxyRes.statusCode} de ${backendUrl}, tentando URL alternativa...`);
        return tryNextUrl(req, res, path);
      }
      
      // Redefinir contagem de falhas se a requisição for bem-sucedida
      failureCount[backendUrl] = 0;
      
      // Configurar os headers da resposta
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      
      // Encaminhar os dados da resposta
      proxyRes.pipe(res, { end: true });
    });
    
    // Configurar timeout
    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      if (!isRetry) {
        failureCount[backendUrl]++;
        console.error(`[PROXY] Timeout na requisição para ${backendUrl}`);
        tryNextUrl(req, res, path);
      } else {
        console.error(`[PROXY] Timeout na URL alternativa, enviando resposta de erro`);
        res.statusCode = 504;
        res.end(JSON.stringify({ error: 'Timeout na comunicação com o backend' }));
      }
    });
    
    // Lidar com erros na requisição
    proxyReq.on('error', (error) => {
      failureCount[backendUrl]++;
      console.error(`[PROXY] Erro na requisição para ${backendUrl}:`, error.message);
      
      if (!isRetry) {
        console.log(`[PROXY] Tentando URL alternativa após erro...`);
        tryNextUrl(req, res, path);
      } else {
        console.error('[PROXY] Erro também na URL alternativa, enviando resposta de erro');
        res.statusCode = 502;
        res.end(JSON.stringify({
          error: 'Erro na comunicação com todos os backends',
          message: error.message
        }));
      }
    });
    
    // Enviar o corpo da requisição se for um método que aceita corpo
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && body) {
      proxyReq.write(body);
    }
    
    // Finalizar a requisição
    proxyReq.end();
  });
}

// Função para tentar próxima URL de backup
function tryNextUrl(req, res, path) {
  // Encontrar a URL com menor número de falhas entre as alternativas
  let bestBackupUrl = BACKUP_URLS[0];
  let minFailures = failureCount[bestBackupUrl];
  
  for (let i = 1; i < BACKUP_URLS.length; i++) {
    if (failureCount[BACKUP_URLS[i]] < minFailures) {
      minFailures = failureCount[BACKUP_URLS[i]];
      bestBackupUrl = BACKUP_URLS[i];
    }
  }
  
  console.log(`[PROXY] Tentando URL alternativa: ${bestBackupUrl}`);
  proxyRequestToUrl(req, res, bestBackupUrl, path, true);
}

// Função principal para encaminhar a requisição
function proxyRequest(req, res, path) {
  // Escolher a URL com menor contagem de falhas
  let targetUrl = BACKEND_URL;
  
  // Se a URL principal tem mais de 3 falhas, buscar a melhor URL alternativa
  if (failureCount[BACKEND_URL] > 3) {
    let bestUrl = BACKEND_URL;
    let minFailures = failureCount[BACKEND_URL];
    
    for (const backupUrl of BACKUP_URLS) {
      if (failureCount[backupUrl] < minFailures) {
        minFailures = failureCount[backupUrl];
        bestUrl = backupUrl;
      }
    }
    
    // Usar a URL alternativa se tiver menos falhas
    if (bestUrl !== BACKEND_URL) {
      console.log(`[PROXY] URL principal com muitas falhas, usando alternativa: ${bestUrl}`);
      targetUrl = bestUrl;
    }
  }
  
  // Encaminhar para a URL escolhida
  proxyRequestToUrl(req, res, targetUrl, path);
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
  
  // Log da requisição
  console.log(`[PROXY] Requisição recebida: ${req.method} ${req.url}`);
  
  // Obter o path específico, se fornecido como query parameter
  const { path } = url.parse(req.url, true).query;
  const targetPath = path || req.url;
  
  // Encaminhar a requisição para o backend
  proxyRequest(req, res, targetPath);
}; 