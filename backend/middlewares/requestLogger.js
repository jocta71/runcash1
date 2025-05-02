/**
 * Middleware para registro detalhado de todas as requisições HTTP
 * Ajuda a identificar problemas de segurança e debugging
 */

/**
 * Registra detalhes de cada requisição HTTP
 * @returns {Function} Express middleware
 */
function requestLogger() {
  return (req, res, next) => {
    // Gerar um ID único para esta requisição
    const requestId = Math.random().toString(36).substring(2, 15);
    
    // Capturar timestamp inicial
    const startTime = Date.now();
    
    // Adicionar o requestId à requisição para uso em outros middlewares
    req.requestId = requestId;
    
    // Informações básicas da requisição
    const method = req.method;
    const path = req.path;
    const query = Object.keys(req.query).length ? JSON.stringify(req.query) : '';
    const userIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'desconhecido';
    const contentType = req.get('Content-Type') || 'nenhum';
    const hasAuth = !!req.get('Authorization');
    
    // Registrar início da requisição
    console.log(`[REQ ${requestId}] ${method} ${path} ${query ? '?' + query : ''}`);
    console.log(`[REQ ${requestId}] IP: ${userIp}, Agente: ${userAgent.substring(0, 50)}...`);
    console.log(`[REQ ${requestId}] Content-Type: ${contentType}, Auth: ${hasAuth ? 'Sim' : 'Não'}`);
    
    // Capturar resposta para logging
    const originalSend = res.send;
    res.send = function(body) {
      // Calcular tempo de resposta
      const responseTime = Date.now() - startTime;
      
      // Registrar resposta
      console.log(`[RES ${requestId}] Status: ${res.statusCode}, Tempo: ${responseTime}ms`);
      
      // Registrar tipo de corpo da resposta (não o conteúdo para evitar dados sensíveis)
      if (body) {
        let bodyType = typeof body;
        if (bodyType === 'string') {
          try {
            // Verificar se é JSON
            JSON.parse(body);
            bodyType = 'application/json';
          } catch (e) {
            bodyType = 'text/plain';
          }
        } else if (Buffer.isBuffer(body)) {
          bodyType = 'binary';
        }
        console.log(`[RES ${requestId}] Tipo de resposta: ${bodyType}, Tamanho: ${
          Buffer.isBuffer(body) ? body.length : (body.toString ? body.toString().length : 'desconhecido')
        } bytes`);
      }
      
      // Se for erro (status >= 400), registrar detalhes adicionais
      if (res.statusCode >= 400) {
        console.log(`[ERR ${requestId}] Erro ${res.statusCode} em ${method} ${path}`);
        if (typeof body === 'string') {
          try {
            const jsonBody = JSON.parse(body);
            console.log(`[ERR ${requestId}] Mensagem: ${jsonBody.message || 'Sem mensagem de erro'}`);
          } catch (e) {
            // Não é JSON, ignorar
          }
        }
      }
      
      // Chamar a função original
      return originalSend.call(this, body);
    };
    
    // Continuar para o próximo middleware
    next();
  };
}

module.exports = requestLogger; 