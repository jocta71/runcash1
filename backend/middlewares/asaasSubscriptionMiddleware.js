/**
 * Middleware para verificação de assinaturas no Asaas
 * Verifica em tempo real o status da assinatura do usuário
 */

const axios = require('axios');

// Obter configuração do Asaas do ambiente
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

/**
 * Verifica o status da assinatura do usuário no Asaas
 * @param {Object} options - Opções de configuração
 * @param {Array} options.allowedStatuses - Status permitidos (default: ['ACTIVE'])
 * @returns {Function} Middleware
 */
exports.verificarAssinatura = (options = {}) => {
  // Status permitidos por padrão
  const allowedStatuses = options.allowedStatuses || ['ACTIVE'];
  
  return async (req, res, next) => {
    try {
      // Verificar se o usuário está autenticado
      if (!req.usuario) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
          error: 'ERROR_NOT_AUTHENTICATED'
        });
      }
      
      // Verificar se o usuário tem um ID de cliente no Asaas
      const asaasCustomerId = req.usuario.asaasCustomerId;
      
      if (!asaasCustomerId) {
        return res.status(403).json({
          success: false,
          message: 'Usuário não possui assinatura cadastrada',
          error: 'ERROR_NO_SUBSCRIPTION',
          requiresSubscription: true
        });
      }
      
      // Verificar assinaturas ativas do cliente no Asaas
      const response = await axios.get(
        `${ASAAS_API_URL}/subscriptions`,
        {
          params: { customer: asaasCustomerId },
          headers: { 
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Verificar se há alguma assinatura com status permitido
      const assinaturas = response.data.data || [];
      const assinaturaAtiva = assinaturas.find(ass => allowedStatuses.includes(ass.status));
      
      if (!assinaturaAtiva) {
        return res.status(403).json({
          success: false,
          message: 'Assinatura inativa ou cancelada',
          error: 'ERROR_INACTIVE_SUBSCRIPTION',
          requiresSubscription: true,
          subscriptionStatus: assinaturas.length > 0 ? assinaturas[0].status : 'NONE'
        });
      }
      
      // Adicionar informações da assinatura à requisição
      req.assinatura = {
        id: assinaturaAtiva.id,
        status: assinaturaAtiva.status,
        valor: assinaturaAtiva.value,
        proxPagamento: assinaturaAtiva.nextDueDate,
        plano: assinaturaAtiva.billingType
      };
      
      // Continuar para o próximo middleware
      next();
    } catch (error) {
      console.error('[Asaas] Erro ao verificar assinatura:', error.message);
      
      // Se for erro de API do Asaas, tratar especificamente
      if (error.response && error.response.data) {
        console.error('[Asaas] Detalhes do erro:', error.response.data);
      }
      
      // Em caso de erro na API do Asaas, permitir acesso para não interromper o serviço
      // Esta é uma estratégia de graceful degradation
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || 
          (error.response && error.response.status >= 500)) {
        console.warn('[Asaas] Erro na API do Asaas, permitindo acesso temporário');
        return next();
      }
      
      // Para outros erros, bloquear acesso
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar status da assinatura',
        error: 'ERROR_SUBSCRIPTION_CHECK_FAILED'
      });
    }
  };
};

/**
 * Middleware simplificado que apenas verifica se existe uma assinatura,
 * mas não faz chamada à API do Asaas (para rotas menos críticas)
 */
exports.verificarAssinaturaBasica = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado',
      error: 'ERROR_NOT_AUTHENTICATED'
    });
  }
  
  // Verificar se o usuário tem assinatura premium no próprio JWT/banco
  if (!req.usuario.premium) {
    return res.status(403).json({
      success: false,
      message: 'Acesso restrito a usuários premium',
      error: 'ERROR_PREMIUM_REQUIRED',
      requiresSubscription: true
    });
  }
  
  next();
}; 