const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const SecurityUtils = require('../utils/SecurityUtils');

/**
 * Middleware para proteger rotas que requerem autenticação
 * Verifica o token JWT e atribui o usuário autenticado à requisição
 */
const protect = asyncHandler(async (req, res, next) => {
  // Verificar tentativas de acesso suspeitas
  if (SecurityUtils.isBlockedIP(req.ip)) {
    SecurityUtils.logSecurityEvent(null, 'Tentativa de IP bloqueado', req);
    return res.status(403).json({
      success: false,
      message: 'Acesso bloqueado'
    });
  }

  let token;

  // Verificar se o token está no header Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Obter token do header
      token = req.headers.authorization.split(' ')[1];
      
      // Verificar se o token existe
      if (!token) {
        res.status(401);
        throw new Error('Não autorizado, token não fornecido');
      }

      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Obter usuário a partir do ID no token (excluindo a senha)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(401);
        throw new Error('Usuário não encontrado');
      }

      // Se a conta estiver desativada
      if (req.user.status !== 'active') {
        SecurityUtils.logSecurityEvent(req.user._id, 'Acesso com conta inativa', req);
        
        res.status(401);
        throw new Error('Conta desativada');
      }

      next();
    } catch (error) {
      // Registrar evento de segurança para erro de autenticação
      SecurityUtils.logSecurityEvent(null, 'Falha de autenticação', req);

      // Incrementar contador de falhas de autenticação
      // Em produção, implementar lógica para bloquear IPs após múltiplas falhas
      
      res.status(401);
      throw new Error('Não autorizado, token inválido');
    }
  } else {
    res.status(401);
    throw new Error('Não autorizado, token não fornecido');
  }
});

/**
 * Middleware para verificar se o usuário tem assinatura válida
 * Deve ser usado após o middleware protect
 */
const requireSubscription = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Autenticação necessária');
  }

  // Verificar se o usuário tem assinatura válida
  if (!req.user.subscription || req.user.subscription.status !== 'active') {
    SecurityUtils.logSecurityEvent(req.user._id, 'Tentativa de acesso sem assinatura', req);
    
    res.status(403);
    throw new Error('Assinatura necessária para acessar este recurso');
  }

  next();
});

/**
 * Middleware para verificar se o usuário é administrador
 * Deve ser usado após o middleware protect
 */
const admin = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Autenticação necessária');
  }

  if (req.user.role !== 'admin') {
    SecurityUtils.logSecurityEvent(req.user._id, 'Tentativa de acesso administrativo', req);
    
    res.status(403);
    throw new Error('Acesso não autorizado, apenas administradores');
  }

  next();
});

/**
 * Middleware para registro de atividade dos usuários
 * Registra informações sobre a requisição
 */
const logActivity = asyncHandler(async (req, res, next) => {
  const activityData = {
    ip: req.ip,
    method: req.method,
    path: req.path,
    userId: req.user ? req.user._id : 'anonymous',
    userAgent: req.headers['user-agent'],
    timestamp: new Date()
  };

  // Em produção, salvar em banco de dados
  // await Activity.create(activityData);
  
  // Apenas para desenvolvimento:
  console.log(`Atividade: ${req.method} ${req.path} por ${activityData.userId}`);
  
  next();
});

module.exports = {
  protect,
  requireSubscription,
  admin,
  logActivity
}; 