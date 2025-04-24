const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Roulette = require('../models/Roulette');
const SecurityUtils = require('../utils/SecurityUtils');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Middleware que verifica se o usuário tem permissão para acessar uma roleta específica
 * baseado no nível de acesso da roleta e no plano de assinatura do usuário
 */
module.exports = {
  /**
   * Verifica se o usuário está autenticado
   */
  authenticate: async (req, res, next) => {
    try {
      // Verifica o token JWT do cabeçalho Authorization
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: 'Acesso não autorizado. Token não fornecido.' 
        });
      }

      // Verificar e decodificar o token
      const decoded = jwt.verify(token, config.JWT_SECRET);
      
      // Buscar o usuário no banco de dados para garantir que ele existe
      // e obter informações atualizadas (como plano de assinatura)
      const user = await User.findById(decoded.userId)
        .select('name email subscriptionPlan active role lastLogin');
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuário não encontrado ou inativo.' 
        });
      }
      
      if (!user.active) {
        // Registra tentativa de acesso com conta inativa
        SecurityUtils.logSecurityEvent(decoded.userId, 'Conta inativa', req);
        return res.status(403).json({ 
          success: false, 
          message: 'Sua conta está inativa. Entre em contato com o suporte.' 
        });
      }
      
      // Atualiza o último login
      await User.findByIdAndUpdate(user._id, { 
        lastLogin: new Date() 
      });
      
      // Adiciona o usuário ao objeto de requisição para uso em outros middlewares
      req.user = user;
      
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token inválido.' 
        });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expirado. Faça login novamente.' 
        });
      }
      
      logger.error('Erro no middleware de autenticação:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor durante autenticação.' 
      });
    }
  },

  /**
   * Verifica se o usuário tem permissão para acessar uma roleta específica
   * baseado no nível de acesso da roleta e no plano de assinatura do usuário
   */
  checkRouletteAccess: async (req, res, next) => {
    try {
      // Deve ser executado após o middleware authenticate
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuário não autenticado.' 
        });
      }
      
      const rouletteId = req.params.id;
      
      // Valida se o ID da roleta é um ID válido do MongoDB
      if (!SecurityUtils.isValidMongoId(rouletteId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID da roleta inválido.' 
        });
      }
      
      // Busca a roleta no banco de dados
      const roulette = await Roulette.findById(rouletteId);
      
      if (!roulette) {
        return res.status(404).json({ 
          success: false, 
          message: 'Roleta não encontrada.' 
        });
      }
      
      // Verifica se a roleta está ativa
      if (!roulette.active) {
        return res.status(403).json({ 
          success: false, 
          message: 'Esta roleta está temporariamente indisponível.' 
        });
      }
      
      // Administradores têm acesso total
      if (req.user.role === 'admin') {
        return next();
      }
      
      // Verifica se o usuário tem o nível de assinatura necessário para acessar a roleta
      const userSubscriptionPlan = req.user.subscriptionPlan || 'free';
      const accessLevels = {
        'free': 0,
        'basic': 1,
        'premium': 2,
        'vip': 3
      };
      
      const userAccessLevel = accessLevels[userSubscriptionPlan];
      const requiredAccessLevel = accessLevels[roulette.accessLevel];
      
      if (userAccessLevel < requiredAccessLevel) {
        // Registra tentativa de acesso não autorizado
        SecurityUtils.logSecurityEvent(
          req.user._id, 
          `Roleta (${roulette.name})`, 
          req
        );
        
        return res.status(403).json({ 
          success: false, 
          message: `Acesso negado. Esta roleta requer plano ${roulette.accessLevel}. Atualize sua assinatura para acessá-la.`,
          requiredPlan: roulette.accessLevel,
          currentPlan: userSubscriptionPlan
        });
      }
      
      // Adiciona a roleta ao objeto de requisição para uso em outros middlewares
      req.roulette = roulette;
      
      next();
    } catch (error) {
      logger.error('Erro ao verificar acesso à roleta:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor ao verificar permissões.' 
      });
    }
  },
  
  /**
   * Verifica se o usuário é um administrador
   */
  isAdmin: (req, res, next) => {
    // Deve ser executado após o middleware authenticate
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não autenticado.' 
      });
    }
    
    if (req.user.role !== 'admin') {
      // Registra tentativa de acesso administrativo não autorizado
      SecurityUtils.logSecurityEvent(
        req.user._id, 
        'Acesso Admin', 
        req
      );
      
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado. Somente administradores podem realizar esta ação.' 
      });
    }
    
    next();
  },
  
  /**
   * Rate limiting para evitar ataques de força bruta
   * Limita o número de requisições por usuário/IP
   */
  rateLimit: (maxRequests = 100, timeWindow = 60 * 1000) => {
    // Armazena contadores de requisições por IP ou usuário
    const requestCounts = new Map();
    
    return (req, res, next) => {
      // Usa o ID do usuário se autenticado, caso contrário usa o IP
      const identifier = req.user ? req.user._id.toString() : (req.ip || req.connection.remoteAddress);
      
      // Obtém o contador atual para este identificador
      const now = Date.now();
      let entry = requestCounts.get(identifier);
      
      if (!entry) {
        entry = {
          count: 0,
          resetTime: now + timeWindow
        };
        requestCounts.set(identifier, entry);
      }
      
      // Reseta o contador se o tempo expirou
      if (now >= entry.resetTime) {
        entry.count = 0;
        entry.resetTime = now + timeWindow;
      }
      
      // Incrementa o contador
      entry.count++;
      
      // Verifica se excedeu o limite
      if (entry.count > maxRequests) {
        logger.warn(`Rate limit excedido para ${identifier}`);
        return res.status(429).json({ 
          success: false, 
          message: 'Muitas requisições. Tente novamente mais tarde.' 
        });
      }
      
      next();
    };
  }
}; 