/**
 * ULTIMATE BLOCKER - Bloqueio absoluto de acesso direto via navegador
 * 
 * Este middleware bloqueia QUALQUER tentativa de acesso direto via navegador,
 * independentemente de parâmetros, headers ou outras configurações.
 * 
 * É uma implementação radical e sem exceções, para ser usada como última camada
 * de proteção quando outras abordagens falham.
 */

function ultimateBlocker() {
  return (req, res, next) => {
    // Identificador único para rastreamento nos logs
    const requestId = Math.random().toString(36).substring(2, 15);
    
    // PASSO 1: Verificar padrão de URL - qualquer URL com 'roulette', 'ROULETTE' ou 'roleta'
    const url = req.originalUrl || req.url || '';
    const pathToCheck = url.split('?')[0].toLowerCase(); // Remove parâmetros de query
    
    const isRouletteEndpoint = (
      pathToCheck.includes('/roulette') || 
      pathToCheck.includes('/roleta')
    );
    
    // Se não for endpoint de roleta, deixar passar
    if (!isRouletteEndpoint) {
      return next();
    }
    
    console.log(`[🛡️ ULTIMATE-BLOCKER ${requestId}] Verificando endpoint de roleta: ${url}`);
    
    // PASSO 2: Detectar todos os possíveis indicadores de navegador
    const userAgent = req.headers['user-agent'] || '';
    const acceptHeader = req.headers['accept'] || '';
    const isXHR = req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    // Verificações mais rígidas e abrangentes para identificar navegadores
    const browserIndicators = [
      // 1. User-Agent contém qualquer fragmento de nome de navegador conhecido
      userAgent.includes('Mozilla'),
      userAgent.includes('Chrome'),
      userAgent.includes('Safari'),
      userAgent.includes('Firefox'),
      userAgent.includes('Edge'),
      userAgent.includes('MSIE'),
      userAgent.includes('Opera'),
      
      // 2. Cabeçalho Accept processa HTML ou imagens (típico de navegadores)
      acceptHeader.includes('text/html'),
      acceptHeader.includes('image/'),
      
      // 3. Accept inclui */* como um tipo aceito (comum em navegadores)
      acceptHeader.includes('*/*'),
      
      // 4. Ausência de cabeçalhos típicos de API
      !req.headers['x-api-key'],
      
      // 5. Presença de cabeçalhos típicos de navegador
      req.headers['upgrade-insecure-requests'],
      req.headers['sec-fetch-site'],
      req.headers['sec-fetch-mode'],
      req.headers['sec-fetch-dest'],
      req.headers['sec-ch-ua']
    ];
    
    // Se QUALQUER dos indicadores acima for verdadeiro, considerar como navegador
    const isBrowser = browserIndicators.some(indicator => indicator === true);
    
    // PASSO 3: Verificar token de autenticação (independente se é navegador ou não)
    const hasValidAuth = (
      req.headers.authorization && 
      req.headers.authorization.startsWith('Bearer ') &&
      req.headers.authorization.length > 10 // Token minimamente válido
    );
    
    console.log(`[🛡️ ULTIMATE-BLOCKER ${requestId}] Browser detectado: ${isBrowser}, Auth presente: ${hasValidAuth}`);
    
    // PASSO 4: Tomada de decisão
    // Se for um navegador E não tiver autenticação válida, bloquear imediatamente
    if (isBrowser && !hasValidAuth) {
      console.log(`[🛡️ ULTIMATE-BLOCKER ${requestId}] 🚫 BLOQUEIO ABSOLUTO: Acesso direto via navegador`);
      
      // Definir cabeçalhos anti-cache extremamente rigorosos
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Retornar uma resposta HTML com instruções claras
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>🚫 Acesso Bloqueado | RunCashh API</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              max-width: 700px;
              margin: 40px auto;
              padding: 20px;
              line-height: 1.6;
              color: #333;
              background: #f9f9f9;
            }
            h1 { color: #e53935; margin-bottom: 30px; }
            h2 { color: #2962ff; margin-top: 30px; }
            pre {
              background: #2b2b2b;
              color: #f8f8f2;
              padding: 15px;
              border-radius: 6px;
              overflow-x: auto;
            }
            .info {
              background: #fff;
              border-left: 4px solid #2962ff;
              padding: 15px;
              margin: 20px 0;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .warning {
              background: #fff3e0;
              border-left: 4px solid #ff9100;
              padding: 15px;
              margin: 20px 0;
            }
            code {
              background: #eee;
              padding: 2px 5px;
              border-radius: 3px;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <h1>🚫 Acesso Direto Bloqueado</h1>
          
          <div class="warning">
            <strong>Erro:</strong> Esta API não pode ser acessada diretamente pelo navegador.
          </div>
          
          <div class="info">
            <strong>Detalhes da solicitação:</strong>
            <ul>
              <li><strong>URL:</strong> ${req.originalUrl}</li>
              <li><strong>Método:</strong> ${req.method}</li>
              <li><strong>ID da requisição:</strong> ${requestId}</li>
              <li><strong>Data e hora:</strong> ${new Date().toISOString()}</li>
            </ul>
          </div>
          
          <h2>Como acessar corretamente</h2>
          <p>Para utilizar esta API, você deve:</p>
          <ol>
            <li>Fazer login na aplicação oficial RunCashh</li>
            <li>Obter um token JWT válido através do processo de autenticação</li>
            <li>Realizar chamadas programáticas usando o token no cabeçalho Authorization</li>
          </ol>
          
          <h2>Exemplo de código para acesso correto</h2>
          <pre>
// Exemplo em JavaScript
async function acessarAPI() {
  const token = 'seu_token_jwt_obtido_no_login';
  
  const response = await fetch('${req.protocol}://${req.get('host')}${req.originalUrl}', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  console.log(data);
}
          </pre>
          
          <p style="margin-top: 30px; font-size: 0.9em; color: #666;">
            © RunCashh API - Este endpoint é protegido e monitorado. Tentativas de acesso não autorizado são registradas.
          </p>
        </body>
        </html>
      `);
    }
    
    // Se algum usuário autenticado com token, permitir passar (mesmo se for navegador)
    // Isso é útil para testes ou quando o desenvolvedor precisa depurar a API
    if (hasValidAuth) {
      console.log(`[🛡️ ULTIMATE-BLOCKER ${requestId}] ✅ Autenticação JWT encontrada, permitindo acesso`);
      return next();
    }
    
    // Bloqueio final para qualquer outra requisição sem token
    console.log(`[🛡️ ULTIMATE-BLOCKER ${requestId}] 🚫 BLOQUEIO FINAL: Requisição sem token válido`);
    return res.status(401).json({
      success: false,
      message: 'Acesso negado - Token JWT obrigatório',
      code: 'ULTIMATE_BLOCK',
      requestId,
      path: req.originalUrl
    });
  };
}

module.exports = ultimateBlocker; 