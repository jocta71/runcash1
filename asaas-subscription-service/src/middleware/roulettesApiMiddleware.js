/**
 * Este middleware deve ser adicionado ao serviço de roletas
 * para verificar se o usuário tem uma assinatura ativa.
 * 
 * IMPORTANTE: Este arquivo deve ser copiado para o serviço de roletas.
 */

const axios = require('axios');

/**
 * Middleware que verifica se o token do usuário tem uma assinatura ativa
 * Deve ser usado após o middleware de autenticação no serviço de roletas
 */
const checkActiveSubscription = async (req, res, next) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado. Faça login para continuar.'
      });
    }

    // Verificar se o token já tem informação sobre assinatura
    if (req.user.hasActiveSubscription !== undefined) {
      // Se o token diz que não tem assinatura ativa, bloquear acesso
      if (!req.user.hasActiveSubscription) {
        return res.status(403).json({
          success: false,
          message: 'Assinatura necessária para acessar este recurso',
          subscriptionRequired: true
        });
      }
      
      // Se o token diz que tem assinatura ativa, verificar com o serviço de assinaturas
      // para garantir que a informação está atualizada
      try {
        const response = await axios.get(
          `${process.env.SUBSCRIPTION_SERVICE_URL}/api/verify/subscription/${req.user.id}`,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.data.data.hasActiveSubscription) {
          return res.status(403).json({
            success: false,
            message: 'Sua assinatura expirou ou foi cancelada. Renove para continuar.',
            subscriptionRequired: true
          });
        }
      } catch (error) {
        // Se houver erro na comunicação com o serviço de assinaturas,
        // confiar no token para não interromper o serviço
        console.error('Erro ao verificar assinatura com serviço externo:', error.message);
        // Continue com o token (ação menos disruptiva)
      }
      
      // Se chegou aqui, o usuário tem assinatura ativa
      next();
      return;
    }

    // Se o token não tem informação sobre assinatura, verificar com o serviço
    try {
      const response = await axios.get(
        `${process.env.SUBSCRIPTION_SERVICE_URL}/api/verify/subscription/${req.user.id}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.data.hasActiveSubscription) {
        return res.status(403).json({
          success: false,
          message: 'Assinatura necessária para acessar este recurso',
          subscriptionRequired: true
        });
      }
      
      // Adicionar informação de assinatura ao objeto req.user para uso posterior
      req.user.hasActiveSubscription = true;
      
      // Usuário tem assinatura ativa, permitir acesso
      next();
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error.message);
      
      // Em caso de erro na comunicação com o serviço de assinaturas,
      // negar acesso por segurança
      return res.status(503).json({
        success: false,
        message: 'Não foi possível verificar sua assinatura. Tente novamente mais tarde.'
      });
    }
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status da assinatura'
    });
  }
};

module.exports = { checkActiveSubscription }; 