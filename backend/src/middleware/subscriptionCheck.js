const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { verifyToken } = require('../utils/jwt');

/**
 * Middleware para verificar se o usuário tem uma assinatura ativa
 * Bloqueia o acesso a rotas premium para usuários sem plano
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    // 1. Obter o token de autenticação
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Não autorizado. Faça login para continuar.' 
      });
    }

    // 2. Verificar e decodificar o token
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido ou expirado.' 
      });
    }

    // 3. Verificar se o usuário existe
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuário não encontrado.' 
      });
    }

    // 4. Verificar se o usuário tem uma assinatura ativa
    const subscription = await Subscription.findOne({ 
      userId: user._id,
      status: { $in: ['active', 'ativo', 'ACTIVE', 'ATIVO'] } 
    });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: 'Acesso restrito. É necessário um plano ativo para acessar este recurso.',
        requiresSubscription: true
      });
    }

    // 5. Adicionar informações ao objeto de requisição para uso posterior
    req.user = user;
    req.subscription = subscription;
    
    // Prosseguir se tudo estiver correto
    next();
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao verificar assinatura.' 
    });
  }
};

module.exports = { requireActiveSubscription }; 