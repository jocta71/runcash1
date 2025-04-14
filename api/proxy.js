/**
 * Proxy genérico para encaminhar solicitações para APIs externas
 */
const https = require('https');
const http = require('http');
const url = require('url');

// Configuração de timeout mais curto (5 segundos)
const REQUEST_TIMEOUT = 5000;

// Dados de fallback para caso de erro
const FALLBACK_DATA = {
  success: false,
  error: "Timeout ou erro no servidor de backend",
  data: [],
  timestamp: new Date().toISOString(),
  _fallback: true
};

module.exports = async (req, res) => {
  // Log detalhado para depuração
  console.log('[PROXY] Recebida requisição:', {
    url: req.url,
    method: req.method,
    headers: req.headers,
    query: req.query || {}
  });
  
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

  try {
    // Parâmetros da query
    const parsedUrl = url.parse(req.url, true);
    const targetPath = parsedUrl.query.path;
    
    if (!targetPath) {
      console.log('[PROXY] Erro: Parâmetro path não fornecido');
      return res.status(400).json({
        error: 'Parâmetro path não fornecido',
        message: 'É necessário especificar um caminho de destino com o parâmetro path'
      });
    }

    // URL base da API de destino
    const targetUrl = 'https://backendapi-production-36b5.up.railway.app';
    
    // Modificar o caminho se estiver solicitando muitos dados
    let fullPath = targetPath;
    if (fullPath.includes('/ROULETTES') || fullPath.includes('/roulettes')) {
      // Extrair query parameters
      const queryStartIndex = fullPath.indexOf('?');
      let path = fullPath;
      let queryParams = new URLSearchParams();
      
      if (queryStartIndex > -1) {
        path = fullPath.substring(0, queryStartIndex);
        const queryString = fullPath.substring(queryStartIndex + 1);
        queryParams = new URLSearchParams(queryString);
        
        // Limitar o número de itens para prevenir timeout
        if (queryParams.has('limit') && parseInt(queryParams.get('limit')) > 100) {
          queryParams.set('limit', '100');
        }
        
        fullPath = `${path}?${queryParams.toString()}`;
      }
    }

    console.log(`[PROXY] Encaminhando requisição para: ${targetUrl}${fullPath}`);

    // Extrair o hostname da URL de destino
    const targetHostname = url.parse(targetUrl).hostname;
    
    // Construir opções para a requisição
    const options = {
      hostname: targetHostname,
      port: url.parse(targetUrl).port || 443,
      path: fullPath,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetHostname
      },
      timeout: REQUEST_TIMEOUT
    };

    // Remover headers problemáticos que podem causar erro
    delete options.headers['content-length'];
    delete options.headers['host']; // Vamos definir o host correto
    options.headers['host'] = targetHostname;
    
    // Criar promise para enviar a requisição com timeout
    const proxyResponse = await Promise.race([
      new Promise((resolve, reject) => {
        const protocol = targetUrl.startsWith('https') ? https : http;
        
        const proxyReq = protocol.request(options, (proxyRes) => {
          console.log(`[PROXY] Resposta recebida com status: ${proxyRes.statusCode}`);
          
          let data = '';
          proxyRes.on('data', (chunk) => {
            data += chunk;
          });
          
          proxyRes.on('end', () => {
            console.log(`[PROXY] Dados recebidos: ${data.substring(0, 200)}...`);
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

        // Enviar corpo da requisição se existir e não for GET/HEAD
        if (req.body && !['GET', 'HEAD'].includes(req.method.toUpperCase())) {
          const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          console.log(`[PROXY] Enviando corpo: ${body.substring(0, 200)}...`);
          proxyReq.write(body);
        }
        
        // Finalizar a requisição
        proxyReq.end();
      }),
      // Promise para timeout
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout de ${REQUEST_TIMEOUT}ms excedido`)), REQUEST_TIMEOUT)
      )
    ]);

    // Copiar os cabeçalhos da resposta original (exceto CORS que já configuramos)
    Object.entries(proxyResponse.headers).forEach(([key, value]) => {
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, value);
      }
    });

    // Configurar cabeçalho Content-Type correto se for JSON
    if (proxyResponse.data && proxyResponse.data.startsWith('{')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }

    // Enviar resposta de volta ao cliente
    return res.status(proxyResponse.statusCode).send(proxyResponse.data);
  } catch (error) {
    console.error('[PROXY] Erro ao processar proxy:', error);
    
    // Verificar se é erro de timeout
    const isTimeout = error.message && error.message.includes('Timeout');
    
    // Informações detalhadas do erro para depuração
    const errorDetails = {
      error: isTimeout ? 'Timeout ao acessar a API' : 'Erro no proxy', 
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      req_url: req.url,
      req_method: req.method
    };
    
    console.error('[PROXY] Detalhes do erro:', errorDetails);
    
    // Retornar dados de fallback para ROULETTES em caso de erro para a aplicação não quebrar
    if (req.url.includes('ROULETTES') || req.url.includes('roulettes')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(FALLBACK_DATA);
    }
    
    return res.status(500).json(errorDetails);
  }
}; 