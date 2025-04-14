/**
 * Proxy para encaminhar solicitações para API externa de roletas
 */
const https = require('https');
const http = require('http');
const url = require('url');

module.exports = async (req, res) => {
  // Configuração CORS adequada para solicitações com credentials
  res.setHeader('Access-Control-Allow-Credentials', true);
  // Usar a origem específica em vez de wildcard para permitir credenciais
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Responder a requisições preflight OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // URL base da API de destino
  const targetUrl = 'https://backendapi-production-36b5.up.railway.app';
  
  // Construir o caminho a ser enviado para a API de destino
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname === '/api/proxy-roulette' 
    ? '/api/ROULETTES' 
    : parsedUrl.pathname.replace('/api', '');
  
  // Incluir query string se existir
  const queryString = parsedUrl.search || '';
  const fullPath = `${path}${queryString}`;
  
  console.log(`[PROXY] Encaminhando requisição para: ${targetUrl}${fullPath}`);

  // Construir opções para a requisição
  const options = {
    hostname: url.parse(targetUrl).hostname,
    port: url.parse(targetUrl).port || 443,
    path: fullPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: url.parse(targetUrl).hostname
    }
  };

  try {
    // Criar promise para enviar a requisição
    const proxyResponse = await new Promise((resolve, reject) => {
      const protocol = targetUrl.startsWith('https') ? https : http;
      const proxyReq = protocol.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', (chunk) => {
          data += chunk;
        });
        proxyRes.on('end', () => {
          resolve({
            statusCode: proxyRes.statusCode,
            headers: proxyRes.headers,
            data
          });
        });
      });

      // Lidar com erros na requisição
      proxyReq.on('error', (error) => {
        console.error('[PROXY] Erro ao encaminhar requisição:', error);
        reject(error);
      });

      // Enviar corpo da requisição se existir
      if (req.body) {
        proxyReq.write(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      }
      
      proxyReq.end();
    });

    // Copiar os cabeçalhos da resposta original (exceto CORS que já configuramos)
    Object.entries(proxyResponse.headers).forEach(([key, value]) => {
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, value);
      }
    });

    // Enviar resposta de volta ao cliente
    return res.status(proxyResponse.statusCode).send(proxyResponse.data);
  } catch (error) {
    console.error('[PROXY] Erro ao processar proxy:', error);
    return res.status(500).json({ 
      error: 'Erro no proxy', 
      message: error.message 
    });
  }
}; 