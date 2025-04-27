/**
 * Middleware para verificar se um usuário possui assinatura premium
 * Bloqueia o acesso a rotas premium para usuários sem assinatura ativa
 */

const ErrorResponse = require('../utils/errorResponse');
const Usuario = require('../models/Usuario');
const Assinatura = require('../models/Assinatura');
const asyncHandler = require('./asyncHandler');

const verificarAssinaturaPremium = asyncHandler(async (req, res, next) => {
  // Garantir que autenticarUsuario já foi executado e temos o ID do usuário
  if (!req.usuario || !req.usuario.id) {
    return next(new ErrorResponse('Acesso não autorizado', 401));
  }

  const userId = req.usuario.id;

  // Buscar usuário com suas informações de assinatura
  const usuario = await Usuario.findById(userId);
  
  if (!usuario) {
    return next(new ErrorResponse('Usuário não encontrado', 404));
  }

  // Verificar se usuário tem assinatura premium
  const assinatura = await Assinatura.findOne({ 
    usuario: userId,
    status: 'ativa',
    validade: { $gt: new Date() }
  });

  if (!assinatura) {
    return next(
      new ErrorResponse(
        'Esta funcionalidade requer assinatura premium ativa. Por favor, atualize seu plano.',
        403
      )
    );
  }

  // Adicionar informações da assinatura ao objeto de requisição para uso posterior
  req.assinatura = assinatura;

  // Se chegou até aqui, usuário tem assinatura premium válida
  next();
});

module.exports = verificarAssinaturaPremium; 