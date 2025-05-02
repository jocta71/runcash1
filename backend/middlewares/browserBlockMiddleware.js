/**
 * Middleware para bloquear acesso direto via navegador aos endpoints protegidos
 * 
 * Este middleware identifica se a requisição está vindo de um navegador ou de uma 
 * chamada programática legítima, e bloqueia acessos diretos via navegador.
 */

function blockBrowserAccess(options = {}) {
  const { bypassForDevMode = false } = options;
  
  return (req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    
    // Verificar se estamos em modo de desenvolvimento e se o bypass está ativado
    if (bypassForDevMode && process.env.NODE_ENV === 'development') {
      console.log(`[BROWSER-BLOCK ${requestId}] Bypass ativado para modo de desenvolvimento`);
      return next();
    }
    
    // Obter informações relevantes da requisição
    const userAgent = req.headers['user-agent'] || '';
    const acceptHeader = req.headers['accept'] || '';
    const isXmlHttpRequest = req.headers['x-requested-with'] === 'XMLHttpRequest';
    const referer = req.headers['referer'] || '';
    const origin = req.headers['origin'] || '';
    
    // Log detalhado para diagnóstico
    console.log(`[BROWSER-BLOCK ${requestId}] Nova requisição para: ${req.method} ${req.originalUrl}`);
    console.log(`[BROWSER-BLOCK ${requestId}] User-Agent: ${userAgent}`);
    console.log(`[BROWSER-BLOCK ${requestId}] Accept: ${acceptHeader}`);
    console.log(`[BROWSER-BLOCK ${requestId}] XHR: ${isXmlHttpRequest}`);
    console.log(`[BROWSER-BLOCK ${requestId}] Referer: ${referer}`);
    console.log(`[BROWSER-BLOCK ${requestId}] Origin: ${origin}`);
    
    // Detectar padrões típicos de navegadores
    const isBrowserLikeRequest = (
      // Padrão: navegador está aceitando HTML como resposta prioritária
      (acceptHeader.includes('text/html') && !acceptHeader.startsWith('application/json')) ||
      
      // Navegador acessando diretamente sem origin ou referer
      (req.method === 'GET' && !origin && !referer && !isXmlHttpRequest) ||
      
      // User-Agent típico de navegador sem headers de API
      (userAgent.includes('Mozilla/') && !isXmlHttpRequest && !req.headers['authorization'])
    );
    
    // Se parece ser um acesso via navegador, bloqueamos
    if (isBrowserLikeRequest) {
      console.log(`[BROWSER-BLOCK ${requestId}] ⛔ BLOQUEANDO acesso direto via navegador`);
      
      // Definir cabeçalhos anti-cache
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      // Retornar página de erro em HTML para navegadores, para deixar claro que é API
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="robots" content="noindex, nofollow">
          <title>Acesso Negado | RunCashh API</title>
          <style>
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              max-width: 800px; 
              margin: 0 auto; 
              padding: 2rem;
              line-height: 1.6;
              color: #333;
            }
            h1 { color: #e53935; }
            pre { 
              background: #f5f5f5; 
              padding: 1rem; 
              border-radius: 4px;
              overflow-x: auto;
            }
            .info {
              background: #e3f2fd;
              padding: 1rem;
              border-radius: 4px;
              margin: 1rem 0;
            }
            code { 
              background: #eee;
              padding: 2px 4px;
              border-radius: 3px;
            }
          </style>
        </head>
        <body>
          <h1>⛔ Acesso Negado</h1>
          <p>Esta é uma API privada que não pode ser acessada diretamente pelo navegador.</p>
          
          <div class="info">
            <strong>Informações técnicas:</strong>
            <ul>
              <li>URL: ${req.method} ${req.originalUrl}</li>
              <li>ID da Requisição: ${requestId}</li>
              <li>Timestamp: ${new Date().toISOString()}</li>
            </ul>
          </div>
          
          <h2>Como usar esta API corretamente</h2>
          <p>Para acessar este endpoint, você precisa:</p>
          <ol>
            <li>Fazer uma requisição programática (não diretamente pelo navegador)</li>
            <li>Incluir um token JWT válido no cabeçalho <code>Authorization</code></li>
            <li>Ter uma assinatura ativa</li>
          </ol>
          
          <h3>Exemplo de requisição correta:</h3>
          <pre>
fetch('${req.protocol}://${req.get('host')}${req.originalUrl}', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer seu_token_jwt_aqui'
  }
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Erro:', error));
          </pre>
        </body>
        </html>
      `);
    }
    
    // Definir cabeçalhos anti-cache para todas as rotas sensíveis
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Se não for acesso via navegador, permitir que continue
    console.log(`[BROWSER-BLOCK ${requestId}] ✓ Requisição válida, prosseguindo`);
    next();
  };
}

module.exports = blockBrowserAccess; 