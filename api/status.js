/**
 * API para verificar status da aplicação e ambiente
 */

module.exports = async (req, res) => {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Retornar imediatamente para requisições OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Testar conexão com o backend
    const backendStatus = await testBackendConnection();
    
    // Coletar informações do ambiente
    const statusInfo = {
      status: "online",
      version: process.env.npm_package_version || "0.1.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      serverInfo: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      backend: backendStatus,
      config: {
        timeout: {
          internal: "5000ms", // Timeout interno configurado
          vercel: "30000ms"   // Timeout do Vercel configurado
        },
        routes: [
          { path: "/api/ROULETTES", handler: "proxy-roulette.js" },
          { path: "/api/proxy-roulette", handler: "proxy-roulette.js" },
          { path: "/api/proxy", handler: "proxy.js" },
          { path: "/api/status", handler: "status.js" }
        ]
      }
    };

    return res.status(200).json(statusInfo);
  } catch (error) {
    console.error('[STATUS] Erro ao gerar informações de status:', error);
    
    return res.status(500).json({
      status: "error",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Testa a conexão com o backend
 */
async function testBackendConnection() {
  const https = require('https');
  const TIMEOUT = 3000;
  
  try {
    const result = await Promise.race([
      new Promise((resolve, reject) => {
        const req = https.get(
          'https://backendapi-production-36b5.up.railway.app/api/ROULETTES?limit=1',
          { timeout: TIMEOUT },
          (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
              data += chunk;
            });
            
            res.on('end', () => {
              resolve({
                reachable: true,
                statusCode: res.statusCode,
                responseTime: Date.now() - startTime,
                responseSize: data.length
              });
            });
          }
        );
        
        const startTime = Date.now();
        
        req.on('error', (err) => {
          reject(err);
        });
        
        req.on('timeout', () => {
          req.destroy();
          reject(new Error(`Timeout na conexão (${TIMEOUT}ms)`));
        });
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout de teste excedido (${TIMEOUT}ms)`)), TIMEOUT)
      )
    ]);
    
    return result;
  } catch (error) {
    return {
      reachable: false,
      error: error.message,
      code: error.code
    };
  }
} 