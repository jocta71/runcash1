const axios = require('axios');

/**
 * Middleware para verificar se o usuário tem assinatura ativa
 * Este middleware deve ser aplicado em todas as rotas de roletas
 */
module.exports = async (req, res, next) => {
  try {
    // Extrair informações do usuário (assumindo que o middleware de autenticação já foi executado)
    const userId = req.user?.id;
    const externalId = req.user?.externalId || userId;
    
    // Se não temos o ID do usuário, não podemos verificar a assinatura
    if (!externalId) {
      console.log('[Subscription Middleware] ID de usuário não encontrado na requisição');
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária'
      });
    }
    
    // Endpoint que estamos protegendo
    const endpoint = req.originalUrl || req.url;
    const method = req.method;
    
    // Verificar se é uma rota de roletas
    if (!endpoint.includes('/api/roulettes')) {
      // Se não for rota de roletas, permitir acesso
      return next();
    }
    
    // URL do serviço de assinaturas (usando variável de ambiente ou fallback)
    const subscriptionServiceUrl = process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3000';
    
    // Verificar assinatura no serviço de assinaturas
    const verifyUrl = `${subscriptionServiceUrl}/api/subscription/verify/${externalId}`;
    
    console.log(`[Subscription Middleware] Verificando assinatura para usuário ${externalId} em ${endpoint}`);
    
    // Fazer requisição para o serviço de assinaturas
    const response = await axios.get(verifyUrl, {
      headers: {
        'x-api-key': process.env.SUBSCRIPTION_SERVICE_API_KEY || 'development_api_key'
      },
      params: {
        endpoint,
        method
      },
      timeout: 3000 // 3 segundos de timeout
    });
    
    // Verificar resposta do serviço de assinaturas
    if (response.data && response.data.success) {
      // Se usuário tem acesso, continuar
      if (response.data.canAccess) {
        console.log(`[Subscription Middleware] Acesso autorizado para ${externalId}`);
        
        // Adicionar dados de acesso à requisição para uso posterior
        req.subscription = {
          isActive: true,
          plan: response.data.access.plan,
          token: response.data.token
        };
        
        return next();
      } else {
        // Se usuário não tem acesso, retornar erro
        console.log(`[Subscription Middleware] Acesso negado para ${externalId}`);
        return res.status(403).json({
          success: false,
          message: 'Acesso negado. É necessário ter uma assinatura ativa para acessar este recurso.',
          subscription: {
            isActive: false,
            plan: response.data.access?.plan || 'FREE'
          },
          upgradeUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/assinatura`
        });
      }
    } else {
      // Se houver problema na verificação, permitir acesso em modo de contingência
      // Esta é uma estratégia para evitar indisponibilidade total em caso de problemas no serviço de assinaturas
      console.warn(`[Subscription Middleware] Erro ao verificar assinatura. Operando em contingência.`);
      
      // Em produção, você pode querer restringir o acesso mesmo em contingência
      // Aqui, optamos por permitir para evitar interrupção de serviço
      if (process.env.NODE_ENV === 'production' && process.env.STRICT_SUBSCRIPTION_CHECK === 'true') {
        return res.status(503).json({
          success: false,
          message: 'Serviço de assinaturas indisponível. Tente novamente mais tarde.'
        });
      }
      
      // Log detalhado em caso de erro
      console.warn(`[Subscription Middleware] Detalhes: ${response?.data?.message || 'Erro desconhecido'}`);
      
      // Em ambiente de desenvolvimento ou contingência permitida, prosseguir
      return next();
    }
  } catch (error) {
    // Em caso de erro, logar e permitir acesso em contingência
    console.error('[Subscription Middleware] Erro:', error.message);
    
    // Em produção com verificação estrita, bloquear acesso
    if (process.env.NODE_ENV === 'production' && process.env.STRICT_SUBSCRIPTION_CHECK === 'true') {
      return res.status(503).json({
        success: false,
        message: 'Serviço de assinaturas indisponível. Tente novamente mais tarde.'
      });
    }
    
    // Em outros ambientes, permitir acesso em contingência
    return next();
  }
}; 