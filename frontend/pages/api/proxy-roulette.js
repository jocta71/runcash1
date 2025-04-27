// Proxy específico para requisições de roletas
import https from 'https';
import http from 'http';
import url from 'url';
import cookie from 'cookie';

// URL do backend no Railway
const BACKEND_URL = 'https://backend-production-2f96.up.railway.app';
const API_PATH = '/api/ROULETTES';

export default function handler(req, res) {
  console.log(`[PROXY-ROULETTE] Recebendo requisição: ${req.method} ${req.url}`);
  
  try {
    // Configurar CORS para permitir requisições cross-origin
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, bypass-tunnel-reminder');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Responder imediatamente para requisições de preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
      console.log('[PROXY-ROULETTE] Respondendo requisição OPTIONS');
      res.status(200).end();
      return;
    }

    // Extrair tokens de autenticação dos cookies e headers
    const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
    const authToken = req.headers.authorization || cookies['auth-token'] || '';
    const refreshToken = cookies['refresh-token'] || '';
    
    console.log(`[PROXY-ROULETTE] Token de autorização disponível: ${authToken ? 'Sim' : 'Não'}`);

    // Determinar o tipo de requisição (normal ou de números)
    const queryParams = new URLSearchParams(url.parse(req.url).query || '');
    const isNumbersRequest = queryParams.get('type') === 'numbers';
    const pathSuffix = isNumbersRequest ? '-numbers' : '';
    
    // Remover parâmetro type para não enviar ao backend
    queryParams.delete('type');
    const cleanedQuery = queryParams.toString() ? `?${queryParams.toString()}` : '';
    
    // Construir URL completa para o backend
    const targetPath = `${API_PATH}${pathSuffix}${cleanedQuery}`;

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
    console.log(`[PROXY-ROULETTE] Método: ${req.method}, Autenticação: ${authToken ? 'Com token' : 'Sem token'}`);
    
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
          
          // Log de resposta para debug
          try {
            const jsonResponse = JSON.parse(responseBody.toString());
            console.log(`[PROXY-ROULETTE] Resposta processada com sucesso, tamanho: ${responseBody.length} bytes`);
            
            // Se houver erro de autenticação, registrar para depuração
            if (proxyRes.statusCode === 401) {
              console.error('[PROXY-ROULETTE] Erro de autenticação 401:', jsonResponse);
            }
          } catch (e) {
            console.log(`[PROXY-ROULETTE] Resposta não é JSON válido, tamanho: ${responseBody.length} bytes`);
          }
          
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
  } catch (error) {
    console.error('[PROXY-ROULETTE] Erro não tratado:', error);
    
    // Se a resposta ainda não foi enviada
    if (!res.headersSent) {
      res.status(500).json({
        error: true,
        message: `Erro interno no proxy: ${error.message}`
      });
    }
  }
} 