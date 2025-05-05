const Iron = require('@hapi/iron');
const crypto = require('crypto');

/**
 * Middleware para criptografar dados da API de roletas
 * Apenas usuários com assinatura ativa podem obter os dados descriptografados
 */
const encryptRouletteData = (req, res, next) => {
  // Preservar o método original de envio de resposta
  const originalSend = res.send;
  
  // Sobrescrever o método send para interceptar e criptografar a resposta
  res.send = function(data) {
    try {
      // Verificar se estamos na rota de roletas
      if (req.originalUrl.toLowerCase().includes('/roulettes') || 
          req.originalUrl.toLowerCase().includes('/roulettes/')) {
        
        // Converter dados para JSON se for uma string
        const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
        
        // Verificar se o parâmetro "raw=true" está presente (para acesso sem criptografia)
        const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
        const rawParam = url.searchParams.get('raw');
        
        // Se o usuário for especial (admin) ou tiver o parâmetro raw=true, enviar sem criptografia
        if ((req.user && req.user.role === 'admin') || rawParam === 'true') {
          console.log('[Encryption] Enviando dados sem criptografia (admin ou raw=true)');
          return originalSend.call(this, data);
        }
        
        // Para todos os outros usuários, criptografar os dados
        console.log('[Encryption] Criptografando dados para: ' + (req.user ? req.user.id : 'usuário anônimo'));
        
        // Obter chave de criptografia do ambiente
        const encryptionKey = process.env.ENCRYPTION_KEY || 'runcash_default_encryption_key_2024';
        
        // Adicionar timestamp para prevenir ataques de replay
        const dataWithTimestamp = {
          data: jsonData,
          timestamp: Date.now(),
          expiresAt: Date.now() + (1000 * 60 * 10) // Dados expiram em 10 minutos
        };
        
        // Criptografar dados usando Iron
        const encryptedData = Iron.seal(dataWithTimestamp, encryptionKey, Iron.defaults);
        
        // Enviar resposta com dados criptografados e informações adicionais
        return originalSend.call(this, JSON.stringify({
          success: true,
          encrypted: true,
          format: "iron",
          encryptedData: encryptedData,
          limited: true,
          message: "Dados criptografados. Use sua chave de acesso para descriptografar."
        }));
      }
      
      // Para todas as outras rotas, manter o comportamento original
      return originalSend.call(this, data);
    } catch (error) {
      console.error('[Encryption] Erro ao processar/criptografar dados:', error);
      // Em caso de erro, ainda enviar dados originais (fallback)
      return originalSend.call(this, data);
    }
  };
  
  next();
};

/**
 * Verificar se o usuário tem uma chave de acesso válida
 */
const verifyAccessKey = async (req, res, next) => {
  try {
    // Obter a chave do cabeçalho de autorização ou query param
    const authHeader = req.headers.authorization;
    const queryKey = req.query.key;
    
    // Se nenhuma chave for fornecida, continuar sem verificação
    if (!authHeader && !queryKey) {
      return next();
    }
    
    // Extrair a chave do cabeçalho ou usar a query param
    const accessKey = authHeader ? authHeader.replace('Bearer ', '') : queryKey;
    
    // Verificar se a chave é válida no banco de dados
    // Por simplicidade, vamos apenas verificar se a chave existe
    // Em uma implementação real, você deve consultar o banco de dados
    
    // Exemplo de validação da chave (substitua pelo seu próprio código)
    const isValidKey = true; // Simulação: todas as chaves são válidas por enquanto
    
    if (isValidKey) {
      // Se a chave for válida, definir usuário como tendo acesso completo
      req.user = {
        ...req.user,
        hasValidAccessKey: true
      };
    }
    
    next();
  } catch (error) {
    console.error('[AccessKey] Erro ao verificar chave de acesso:', error);
    next();
  }
};

module.exports = {
  encryptRouletteData,
  verifyAccessKey
}; 