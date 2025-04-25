// Endpoint para diagnóstico do sistema
const proxy = require('./proxy');

/**
 * Endpoint de diagnóstico para verificar o status do sistema
 * Este endpoint verifica:
 * 1. Conectividade com o backend
 * 2. Status dos endpoints otimizados
 * 3. Configurações do cliente
 */
module.exports = async (req, res) => {
  try {
    console.log(`[API] Requisição de diagnóstico recebida`);
    
    // Tentar verificar o status do backend usando o endpoint de diagnóstico
    try {
      // Configuração para o proxy
      req.url = '/api/diagnostico';
      
      // Adicionar timestamp para evitar cache
      if (req.query && !req.query._t) {
        if (!req.query) req.query = {};
        req.query._t = Date.now();
      }
      
      // Adicionar cabeçalhos de identificação
      const headers = req.headers || {};
      headers['x-client-diagnostics'] = 'true';
      headers['x-client-version'] = process.env.APP_VERSION || '1.0.0';
      req.headers = headers;
      
      console.log(`[API] Diagnóstico: Redirecionando para endpoint do backend`);
      
      // Repassar para o proxy geral
      return proxy(req, res);
    } catch (proxyError) {
      console.error(`[API] Erro ao conectar com o backend:`, proxyError);
      
      // Se a requisição falhar, retornar diagnóstico básico
      res.status(500).json({
        timestamp: new Date().toISOString(),
        status: 'ERRO',
        mensagem: 'Não foi possível conectar ao backend para diagnóstico completo',
        erro: proxyError.message,
        clientInfo: {
          vercelRegion: process.env.VERCEL_REGION || 'n/a',
          nodeVersion: process.version,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        }
      });
    }
  } catch (error) {
    console.error(`[API] Erro ao processar diagnóstico:`, error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      status: 'ERRO',
      mensagem: 'Erro durante diagnóstico',
      erro: error.message
    });
  }
}; 