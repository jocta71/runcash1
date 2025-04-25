// Endpoint para verificar status da API
const https = require('https');
const http = require('http');
const url = require('url');

// URLs dos backends
const BACKEND_URLS = [
  'https://backendapi-production-36b5.up.railway.app',
  'https://runcash-websocket.up.railway.app',
  'https://api.runcash.app'
];

// Função para testar conectividade com um endpoint específico
function testEndpoint(backendUrl, path) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const parsedUrl = url.parse(backendUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path,
      method: 'GET',
      timeout: 5000 // 5 segundos de timeout
    };
    
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      let responseData = '';
      
      res.on('data', chunk => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        let jsonData = null;
        try {
          jsonData = JSON.parse(responseData);
        } catch (e) {
          // Não é JSON ou está vazio
        }
        
        resolve({
          url: backendUrl + path,
          statusCode: res.statusCode,
          responseTime,
          headers: res.headers,
          data: jsonData || (responseData.length > 200 ? responseData.substring(0, 200) + '...' : responseData)
        });
      });
    });
    
    req.on('error', (error) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      resolve({
        url: backendUrl + path,
        error: error.message,
        responseTime,
        statusCode: 0
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        url: backendUrl + path,
        error: 'Timeout',
        responseTime: 5000,
        statusCode: 0
      });
    });
    
    req.end();
  });
}

// Handler para o endpoint de diagnóstico da API
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Testar endpoints em todos os backends
    const endpoints = ['/api/status', '/api/ROULETTES?limit=1', '/socket-status'];
    const results = {};
    
    // Testar cada combinação de backend/endpoint
    const tests = [];
    
    for (const backend of BACKEND_URLS) {
      for (const endpoint of endpoints) {
        tests.push(testEndpoint(backend, endpoint));
      }
    }
    
    // Executar todos os testes em paralelo
    const testResults = await Promise.all(tests);
    
    // Organizar resultados por backend
    for (const backend of BACKEND_URLS) {
      results[backend] = {};
      
      for (const endpoint of endpoints) {
        const result = testResults.find(r => r.url === backend + endpoint);
        results[backend][endpoint] = result || { error: 'Teste não executado' };
      }
    }
    
    // Verificar conectividade local
    const localResult = await testEndpoint(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`, '/api/ROULETTES?limit=1');
    
    // Retornar diagnóstico completo
    res.status(200).json({
      timestamp: new Date().toISOString(),
      serverInfo: {
        host: req.headers.host,
        protocol: req.headers['x-forwarded-proto'] || 'https',
        userAgent: req.headers['user-agent']
      },
      localConnectivity: localResult,
      backendResults: results,
      environment: process.env.NODE_ENV || 'development',
      currentBackend: process.env.BACKEND_URL || BACKEND_URLS[0],
      proxies: req.headers['x-forwarded-for'] || 'none'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao executar diagnóstico',
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
  }
}; 