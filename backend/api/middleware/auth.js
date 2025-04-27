const jwt = require('jsonwebtoken');
const getDb = require('../../services/database');
const { ObjectId } = require('mongodb');

/**
 * Middleware para proteção de rotas, requer autenticação via JWT
 */
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Verificar se o token está presente no header de autorização
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Extrair o token do header
      token = req.headers.authorization.split(' ')[1];
    } 
    // Ou usar o token dos cookies se disponível
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Se o token não estiver presente, retornar erro
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado para acessar este recurso'
      });
    }

    try {
      // Verificar se o token é válido
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'runcash-default-secret');
      
      // Adicionar o usuário decodificado ao objeto de requisição
      req.user = {
        id: decoded.id || decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user',
        username: decoded.username || decoded.name
      };
      
      // Adicionar também no formato usado em outros middlewares para compatibilidade
      req.usuario = {
        id: decoded.id || decoded.userId,
        email: decoded.email,
        tipo: decoded.role || 'user',
        nome: decoded.username || decoded.name
      };
      
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erro no servidor durante autenticação'
    });
  }
};

/**
 * Middleware para autenticação opcional - não bloqueia se não houver token
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    // Verificar se o token está presente no header de autorização
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Extrair o token do header
      token = req.headers.authorization.split(' ')[1];
    } 
    // Ou usar o token dos cookies se disponível
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Se o token não estiver presente, continuar sem usuário autenticado
    if (!token) {
      req.user = null;
      req.usuario = null;
      return next();
    }

    try {
      // Verificar se o token é válido
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'runcash-default-secret');
      
      // Adicionar o usuário decodificado ao objeto de requisição
      req.user = {
        id: decoded.id || decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user',
        username: decoded.username || decoded.name
      };
      
      // Adicionar também no formato usado em outros middlewares para compatibilidade
      req.usuario = {
        id: decoded.id || decoded.userId,
        email: decoded.email,
        tipo: decoded.role || 'user',
        nome: decoded.username || decoded.name
      };
    } catch (error) {
      // Em caso de erro no token, continuar sem usuário
      req.user = null;
      req.usuario = null;
    }
    
    next();
  } catch (error) {
    // Em caso de erro interno, continuar sem usuário
    req.user = null;
    req.usuario = null;
    next();
  }
};

/**
 * Middleware para verificar permissões de administrador
 */
exports.admin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a administradores'
    });
  }
};

/**
 * Middleware para verificar status da assinatura sem bloquear acesso
 * Apenas adiciona informações à requisição
 */
exports.checkSubscription = async (req, res, next) => {
  try {
    // Se não há usuário autenticado, continuar sem verificar assinatura
    if (!req.user && !req.usuario) {
      req.hasActiveSubscription = false;
      req.subscription = null;
      return next();
    }
    
    const userId = req.user?.id || req.usuario?.id;
    const db = await getDb();
    
    // Verificar assinatura na collection mais recente
    const subscription = await db.collection('subscriptions').findOne({
      user_id: userId,
      status: { $in: ['active', 'ACTIVE', 'ativa'] },
      expirationDate: { $gt: new Date() }
    });
    
    // Se encontrou assinatura ativa
    if (subscription) {
      req.hasActiveSubscription = true;
      req.subscription = subscription;
      return next();
    }
    
    // Verificar também no formato antigo de assinaturas (modelo mongoose)
    const assinatura = await db.collection('assinaturas').findOne({
      usuario: ObjectId.isValid(userId) ? new ObjectId(userId) : userId,
      status: 'ativa',
      validade: { $gt: new Date() }
    });
    
    if (assinatura) {
      req.hasActiveSubscription = true;
      req.assinatura = assinatura;
    } else {
      req.hasActiveSubscription = false;
    }
    
    next();
  } catch (error) {
    // Em caso de erro, não bloquear o acesso
    req.hasActiveSubscription = false;
    next();
  }
};

/**
 * Middleware para verificar se o usuário tem uma assinatura ativa
 * Bloqueia acesso se não tiver
 */
exports.requireSubscription = async (req, res, next) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user && !req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária para acessar este recurso',
        error: 'AUTH_REQUIRED'
      });
    }

    const userId = req.user?.id || req.usuario?.id;
    const db = await getDb();
    
    // Verificar assinatura na collection mais recente
    const subscription = await db.collection('subscriptions').findOne({
      user_id: userId,
      status: { $in: ['active', 'ACTIVE', 'ativa'] },
      expirationDate: { $gt: new Date() }
    });
    
    // Se encontrou assinatura ativa
    if (subscription) {
      req.hasActiveSubscription = true;
      req.subscription = subscription;
      return next();
    }
    
    // Verificar também no formato antigo de assinaturas (modelo mongoose)
    const assinatura = await db.collection('assinaturas').findOne({
      usuario: ObjectId.isValid(userId) ? new ObjectId(userId) : userId,
      status: 'ativa',
      validade: { $gt: new Date() }
    });
    
    if (assinatura) {
      req.hasActiveSubscription = true;
      req.assinatura = assinatura;
      return next();
    }
    
    // Se não encontrou assinatura ativa, negar acesso
    return res.status(403).json({
      success: false,
      message: 'Você precisa de uma assinatura ativa para acessar este recurso',
      error: 'SUBSCRIPTION_REQUIRED'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar assinatura',
      error: error.message
    });
  }
}; 