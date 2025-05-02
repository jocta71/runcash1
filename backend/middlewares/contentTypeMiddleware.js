/**
 * Middleware para validação e processamento do content-type da requisição
 * 
 * Este middleware verifica se o content-type da requisição é compatível com o esperado
 * e rejeita requisições com formatos incompatíveis.
 */

function validateContentType(allowedTypes = ['application/json']) {
  return (req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    const contentType = req.headers['content-type'] || '';
    
    // Log para diagnóstico
    console.log(`[CONTENT-TYPE ${requestId}] Tipo de conteúdo: ${contentType}`);
    
    // Se for requisição OPTIONS, deixar passar
    if (req.method === 'OPTIONS') {
      return next();
    }
    
    // Se for GET ou não tem body, não precisa validar content-type
    if (req.method === 'GET' || !req.body || Object.keys(req.body).length === 0) {
      console.log(`[CONTENT-TYPE ${requestId}] Método ${req.method} sem body, validação ignorada`);
      return next();
    }
    
    // Verificar se o content-type está na lista de tipos permitidos
    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    
    if (!isAllowed) {
      console.log(`[CONTENT-TYPE ${requestId}] Content-Type não permitido: ${contentType}`);
      
      // Aplicar cabeçalhos para prevenir cache
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      
      // Retornar erro de content-type incompatível
      return res.status(415).json({
        success: false,
        message: 'Content-Type não suportado',
        allowedTypes: allowedTypes,
        receivedType: contentType,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        requestId
      });
    }
    
    // Se chegou aqui, o content-type é válido
    console.log(`[CONTENT-TYPE ${requestId}] Content-Type válido: ${contentType}`);
    next();
  };
}

// Configuração específica para application/x-www-form-urlencoded
function requireFormUrlEncoded() {
  return validateContentType(['application/x-www-form-urlencoded']);
}

// Configuração específica para application/json
function requireJson() {
  return validateContentType(['application/json']);
}

// Configuração para aceitar ambos os formatos
function acceptJsonOrForm() {
  return validateContentType(['application/json', 'application/x-www-form-urlencoded']);
}

module.exports = {
  validateContentType,
  requireFormUrlEncoded,
  requireJson,
  acceptJsonOrForm
}; 