/**
 * Middleware para verificação de assinaturas
 * Versão simplificada para ambiente de desenvolvimento
 */

const axios = require('axios');

// Obter configuração do Asaas do ambiente
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Flag para determinar se devemos usar a API do Asaas
const USE_ASAAS_API = !!ASAAS_API_KEY;

// Avisar no console se estamos em modo simplificado
if (!USE_ASAAS_API) {
  console.warn('[Asaas] ASAAS_API_KEY não encontrada. Usando modo de verificação simplificado.');
  console.warn('[Asaas] Todos os usuários serão tratados como tendo assinatura ativa.');
}

/**
 * Verifica o status da assinatura do usuário
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
      if (!req.usuario && !req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
          error: 'ERROR_NOT_AUTHENTICATED'
        });
      }
      
      // Normalizar objeto de usuário (pode estar em req.usuario ou req.user)
      const usuario = req.usuario || req.user;
      
      // Se não estamos usando a API do Asaas, apenas continuar
      if (!USE_ASAAS_API) {
        // Em modo de desenvolvimento, fingir que existe uma assinatura
        req.assinatura = {
          id: 'dev_subscription',
          status: 'ACTIVE',
          valor: 99.90,
          proxPagamento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          plano: 'CREDIT_CARD'
        };
        return next();
      }
      
      // Verificar se o usuário tem um ID de cliente no Asaas
      const asaasCustomerId = usuario.asaasCustomerId;
      
      if (!asaasCustomerId) {
        // Em modo de desenvolvimento, permitir acesso mesmo sem ID
        if (!USE_ASAAS_API) {
          return next();
        }
        
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
      
      // Em modo de desenvolvimento, permitir acesso mesmo com erro
      if (!USE_ASAAS_API) {
        console.warn('[Asaas] Erro ignorado no modo de desenvolvimento');
        req.assinatura = {
          id: 'dev_subscription',
          status: 'ACTIVE',
          valor: 99.90,
          proxPagamento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          plano: 'CREDIT_CARD'
        };
        return next();
      }
      
      // Em caso de erro na API do Asaas, permitir acesso para não interromper o serviço
      // Esta é uma estratégia de graceful degradation
      console.warn('[Asaas] Erro na API do Asaas, permitindo acesso temporário');
      return next();
    }
  };
};

/**
 * Middleware simplificado que apenas verifica se existe uma assinatura,
 * sem fazer chamada à API do Asaas
 */
exports.verificarAssinaturaBasica = (req, res, next) => {
  // Se estamos em modo de desenvolvimento, permitir acesso
  if (!USE_ASAAS_API) {
    return next();
  }
  
  if (!req.usuario && !req.user) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado',
      error: 'ERROR_NOT_AUTHENTICATED'
    });
  }
  
  // Normalizar objeto de usuário
  const usuario = req.usuario || req.user;
  
  // Verificar se o usuário tem assinatura premium no próprio JWT/banco
  if (!usuario.premium) {
    return res.status(403).json({
      success: false,
      message: 'Acesso restrito a usuários premium',
      error: 'ERROR_PREMIUM_REQUIRED',
      requiresSubscription: true
    });
  }
  
  next();
}; 