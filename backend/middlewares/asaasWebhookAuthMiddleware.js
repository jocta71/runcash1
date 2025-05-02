/**
 * Middleware para autenticação dos webhooks do Asaas
 * Verifica token de autenticação para garantir que a solicitação veio do Asaas
 */

/**
 * Lista de IPs oficiais do Asaas, conforme documentação
 * @see https://docs.asaas.com/docs/ips-oficiais-do-asaas
 */
const ASAAS_IPS = [
  // Produção
  '18.231.116.124',
  '18.231.165.85',
  '177.71.136.34',
  '177.71.183.184',
  // Sandbox
  '52.67.61.41',
  '54.94.243.29',
  '54.207.233.86',
  '52.67.90.163'
];

/**
 * Middleware para autenticar webhooks do Asaas
 * Pode verificar token e/ou IPs, conforme configuração
 */
const asaasWebhookAuth = (options = { checkToken: true, checkIp: false }) => {
  return (req, res, next) => {
    try {
      const isAuthenticated = validateAsaasWebhook(req, options);
      
      if (!isAuthenticated) {
        console.error('[AsaasWebhookAuth] Falha na autenticação do webhook');
        return res.status(401).json({
          success: false,
          message: 'Não autorizado'
        });
      }
      
      next();
    } catch (error) {
      console.error('[AsaasWebhookAuth] Erro ao autenticar webhook', error);
      // Para evitar problemas na fila do Asaas, retornamos 200 mesmo com erro de autenticação
      // mas não executamos o processamento
      return res.status(200).json({
        success: false,
        message: 'Erro na autenticação',
        error: 'AUTH_ERROR'
      });
    }
  };
};

/**
 * Valida se a requisição veio realmente do Asaas
 * @param {Object} req - Requisição Express
 * @param {Object} options - Opções de validação
 * @returns {boolean} Se a requisição é válida
 */
function validateAsaasWebhook(req, options) {
  const { checkToken, checkIp } = options;
  let isValid = true;
  
  // Verificar token de autenticação no cabeçalho
  if (checkToken) {
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    const receivedToken = req.headers['asaas-access-token'] || 
                         req.headers['access-token'] || 
                         req.query.access_token;
    
    // Se o token está configurado e não coincide, falha na autenticação
    if (expectedToken && expectedToken !== receivedToken) {
      console.warn('[AsaasWebhookAuth] Token inválido ou não fornecido');
      isValid = false;
    }
  }
  
  // Verificar IP de origem (opcional)
  if (checkIp && isValid) {
    const ip = req.headers['x-forwarded-for'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);
    
    // Verificar se o IP está na lista de IPs permitidos
    const ipValid = ASAAS_IPS.some(allowedIp => {
      return ip === allowedIp || ip.includes(allowedIp);
    });
    
    if (!ipValid) {
      console.warn(`[AsaasWebhookAuth] IP não autorizado: ${ip}`);
      isValid = false;
    }
  }
  
  return isValid;
}

module.exports = asaasWebhookAuth; 