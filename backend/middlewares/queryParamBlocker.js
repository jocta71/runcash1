/**
 * QUERY PARAM BLOCKER
 * 
 * Este middleware bloqueia especificamente acessos com parâmetros
 * de consulta específicos que podem estar causando bypass nas proteções,
 * como o parâmetro "_I" identificado nos logs.
 */

function queryParamBlocker() {
  return (req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    const url = req.originalUrl || req.url || '';
    
    // Verificar se é uma rota de roleta antes de prosseguir
    const isRouletteEndpoint = (
      url.includes('/roulette') || 
      url.includes('/ROULETTE') || 
      url.includes('/roleta')
    );
    
    if (!isRouletteEndpoint) {
      return next();
    }
    
    // Extrair os parâmetros de consulta da URL
    const queryParams = {};
    if (url.includes('?')) {
      const queryString = url.split('?')[1];
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key) queryParams[key] = value;
      });
    }
    
    // Verificar se há parâmetros suspeitos
    const suspiciousParams = [
      '_I', '_i', '_t', '_T', 
      // Adicione outros parâmetros conhecidos que causam problemas
    ];
    
    // Verificar se algum dos parâmetros suspeitos está presente
    const foundSuspiciousParams = suspiciousParams.filter(param => 
      Object.keys(queryParams).includes(param)
    );
    
    if (foundSuspiciousParams.length > 0) {
      console.log(`[🔍 QUERY-BLOCKER ${requestId}] Detectados parâmetros suspeitos em: ${url}`);
      console.log(`[🔍 QUERY-BLOCKER ${requestId}] Parâmetros: ${foundSuspiciousParams.join(', ')}`);
      
      // Verificar se a autenticação está presente
      const hasValidAuth = (
        req.headers.authorization && 
        req.headers.authorization.startsWith('Bearer ')
      );
      
      // Se não tiver autenticação, bloquear
      if (!hasValidAuth) {
        console.log(`[🔍 QUERY-BLOCKER ${requestId}] 🚫 Bloqueando acesso com parâmetros suspeitos sem autenticação`);
        
        // Verificar se é um navegador para retornar HTML ou JSON
        const userAgent = req.headers['user-agent'] || '';
        const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || 
                          userAgent.includes('Safari') || userAgent.includes('Firefox');
        
        if (isBrowser) {
          return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Acesso Negado | RunCashh API</title>
              <style>
                body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
                h1 { color: #d32f2f; }
                .warning { background: #fff8e1; border-left: 4px solid #ffa000; padding: 1rem; }
              </style>
            </head>
            <body>
              <h1>🚫 Acesso Direto Bloqueado</h1>
              <div class="warning">
                <strong>Acesso negado:</strong> Tentativa de bypass detectada usando parâmetros suspeitos: ${foundSuspiciousParams.join(', ')}
              </div>
              <p>Este endpoint requer autenticação via token JWT e não pode ser acessado diretamente pelo navegador.</p>
              <p>Para mais informações, consulte a documentação da API ou entre em contato com o suporte.</p>
            </body>
            </html>
          `);
        } else {
          return res.status(403).json({
            success: false,
            message: 'Acesso negado - Tentativa de bypass detectada',
            code: 'QUERY_PARAM_BLOCK',
            requestId,
            suspiciousParams: foundSuspiciousParams
          });
        }
      }
    }
    
    // Se não houver parâmetros suspeitos ou houver autenticação válida, continuar
    next();
  };
}

module.exports = queryParamBlocker; 