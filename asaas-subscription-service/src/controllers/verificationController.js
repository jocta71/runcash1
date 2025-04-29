const Subscription = require('../models/Subscription');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * Verifica se um usuário tem uma assinatura ativa
 * Esta rota é usada por outros serviços para verificar assinaturas
 */
exports.verifySubscription = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário é obrigatório'
      });
    }
    
    // Verificar se o usuário existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar se o usuário tem assinatura ativa
    const hasActiveSubscription = await Subscription.hasActiveSubscription(userId);
    
    // Se não tiver assinatura ativa, retornar falso
    if (!hasActiveSubscription) {
      return res.status(200).json({
        success: true,
        data: {
          hasActiveSubscription: false
        }
      });
    }
    
    // Buscar detalhes da assinatura
    const subscription = await Subscription.getActiveSubscription(userId);
    
    res.status(200).json({
      success: true,
      data: {
        hasActiveSubscription: true,
        subscription: {
          id: subscription._id,
          plan: subscription.plan,
          status: subscription.status,
          nextDueDate: subscription.nextDueDate
        }
      }
    });
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar assinatura',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro no servidor'
    });
  }
};

/**
 * Verifica se um token JWT tem informações válidas de assinatura
 * Esta rota é usada por outros serviços para validar tokens
 */
exports.verifyToken = async (req, res) => {
  try {
    let token;
    
    // Verificar se o token está nos headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.body.token) {
      // Ou se foi enviado no corpo da requisição
      token = req.body.token;
    }
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token não fornecido'
      });
    }
    
    // Verificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar se o token contém informações sobre assinatura
    if (decoded.hasActiveSubscription === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Token não contém informações sobre assinatura'
      });
    }
    
    // Se o token indicar que tem assinatura, verificar no banco de dados
    if (decoded.hasActiveSubscription) {
      const userId = decoded.id;
      
      // Verificar se o usuário existe
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }
      
      // Verificar assinatura ativa no banco de dados
      const hasActiveSubscription = await Subscription.hasActiveSubscription(userId);
      
      // Se o token indica que tem assinatura mas não tem no banco, o token está desatualizado
      if (!hasActiveSubscription) {
        return res.status(200).json({
          success: true,
          isValid: false,
          reason: 'token_outdated',
          data: {
            hasActiveSubscription: false
          }
        });
      }
      
      // Buscar detalhes da assinatura
      const subscription = await Subscription.getActiveSubscription(userId);
      
      return res.status(200).json({
        success: true,
        isValid: true,
        data: {
          hasActiveSubscription: true,
          user: {
            id: user._id,
            email: user.email,
            role: user.role
          },
          subscription: {
            id: subscription._id,
            plan: subscription.plan,
            status: subscription.status,
            nextDueDate: subscription.nextDueDate
          }
        }
      });
    }
    
    // Se chegou aqui, o token é válido mas indica que não tem assinatura
    res.status(200).json({
      success: true,
      isValid: true,
      data: {
        hasActiveSubscription: false,
        user: {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role
        }
      }
    });
  } catch (error) {
    // Se o erro for de token inválido ou expirado
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        isValid: false,
        reason: error.name === 'TokenExpiredError' ? 'token_expired' : 'token_invalid',
        message: error.message
      });
    }
    
    console.error('Erro ao verificar token:', error);
    res.status(500).json({
      success: false,
      isValid: false,
      reason: 'server_error',
      message: 'Erro ao verificar token',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro no servidor'
    });
  }
}; 